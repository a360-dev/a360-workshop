package handlers

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"a360-platform/backend/internal/models"
	"a360-platform/backend/internal/pipeline"
	"a360-platform/backend/internal/s3"
	"a360-platform/backend/internal/utils"
)

type ProjectHandler struct {
	DB *gorm.DB
	R2 *s3.R2Service
}

// Limit concurrent slicing to prevent OOM across all requests
var slicingSemaphore = make(chan struct{}, 2)

// View throttling in-memory cache: [IP + ProjectID] -> lastViewTime
var viewCache sync.Map

func (h *ProjectHandler) shouldIncrementView(ip, projectID string) bool {
	cacheKey := fmt.Sprintf("%s:%s", ip, projectID)
	now := time.Now()

	if lastTime, ok := viewCache.Load(cacheKey); ok {
		if now.Sub(lastTime.(time.Time)) < 5*time.Minute {
			return false
		}
	}

	viewCache.Store(cacheKey, now)
	return true
}

func (h *ProjectHandler) generateUniqueMagicCode() string {
	for {
		code := utils.GenerateMagicCode(4)
		var count int64
		// Check if exists (including soft-deleted if you want absolute uniqueness, but usually not needed)
		h.DB.Model(&models.Project{}).Where("magic_code = ?", code).Count(&count)
		if count == 0 {
			return code
		}
	}
}

func (h *ProjectHandler) UploadPano(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	// Get user to check quota
	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "User not found"})
	}

	// Check creative phase expiry
	if !user.IsAdmin && time.Now().After(user.ExpiresAt) {
		return c.Status(403).JSON(fiber.Map{"error": "Creative Phase expired. Please contact A360 Workshop Team to extend your license."})
	}

	// Check project limit
	var projectCount int64
	h.DB.Model(&models.Project{}).Where("user_id = ?", userID).Count(&projectCount)
	if !user.IsAdmin && int(projectCount) >= user.ProjectLimit {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("Project limit reached (%d/%d)", projectCount, user.ProjectLimit)})
	}

	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Failed to parse form"})
	}

	files := form.File["panos[]"]
	if len(files) == 0 {
		// Fallback for single file
		singleFile, err := c.FormFile("pano")
		if err == nil {
			files = append(files, singleFile)
		}
	}

	if len(files) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No panoramas uploaded"})
	}

	// Quota check (Batch)
	var totalSize int64
	for _, file := range files {
		totalSize += file.Size
	}

	quotaMB, _ := strconv.ParseInt(os.Getenv("STORAGE_QUOTA_MB"), 10, 64)
	if quotaMB == 0 {
		quotaMB = 500
	}
	if user.StorageUsed+totalSize > quotaMB*1024*1024 {
		return c.Status(403).JSON(fiber.Map{"error": "Storage quota exceeded"})
	}

	projectID := uuid.New().String()
	isPublic := c.FormValue("is_public") == "true"
	magicCode := ""
	if isPublic {
		magicCode = h.generateUniqueMagicCode()
	}

	// Create Project record
	project := models.Project{
		ID:        projectID,
		UserID:    userID,
		Name:      c.FormValue("name"),
		IsPublic:  isPublic,
		MagicCode: magicCode,
		Size:      totalSize,
		Status:    "processing",
	}
	h.DB.Create(&project)

	// Update user storage
	user.StorageUsed += totalSize
	h.DB.Save(&user)

	// Process each scene
	for i, file := range files {
		sceneID := uuid.New().String()
		scenePath := fmt.Sprintf("uploads/%s/%s", projectID, sceneID)
		uploadPath := fmt.Sprintf("./%s", scenePath)
		os.MkdirAll(uploadPath, 0755)

		filePath := filepath.Join(uploadPath, "original.jpg")
		if err := c.SaveFile(file, filePath); err != nil {
			continue
		}

		scene := models.Scene{
			ID:           sceneID,
			ProjectID:    projectID,
			Name:         fmt.Sprintf("Scene %d", i+1),
			PanoPath:     scenePath,
			Status:       "processing",
			DisplayOrder: i,
			Size:         file.Size,
		}
		h.DB.Create(&scene)

		// Set the first scene as the project's PanoPath for backward compatibility/thumbnail
		if i == 0 {
			h.DB.Model(&project).Update("pano_path", scenePath)
		}

		// Async Slice Pano
		go func(sid, pid, fpath string, db *gorm.DB, r2 *s3.R2Service) {
			slicingSemaphore <- struct{}{}
			defer func() { <-slicingSemaphore }()

			ctx := context.Background()
			cubeDir := filepath.Join(filepath.Dir(fpath), "cubemap")
			facePaths, err := pipeline.SlicePano(fpath, cubeDir)

			if err == nil && r2 != nil {
				// Upload original
				r2.UploadFile(ctx, fmt.Sprintf("%s/%s/original.jpg", pid, sid), fpath, "image/jpeg")
				// Upload faces
				for _, fp := range facePaths {
					r2.UploadFile(ctx, fmt.Sprintf("%s/%s/cubemap/%s", pid, sid, filepath.Base(fp)), fp, "image/jpeg")
				}
				// Upload thumbnail
				thumbPath := filepath.Join(filepath.Dir(cubeDir), "thumbnail.jpg")
				r2.UploadFile(ctx, fmt.Sprintf("%s/%s/thumbnail.jpg", pid, sid), thumbPath, "image/jpeg")

				// Cleanup local project dir
				os.RemoveAll(filepath.Dir(fpath))
			}

			status := "ready"
			if err != nil {
				status = "error"
			}

			db.Model(&models.Scene{}).Where("id = ?", sid).Update("status", status)

			// Update project status to ready if all scenes are ready or error
			var unfinished int64
			db.Model(&models.Scene{}).Where("project_id = ? AND status = ?", pid, "processing").Count(&unfinished)
			if unfinished == 0 {
				db.Model(&models.Project{}).Where("id = ?", pid).Update("status", "ready")
			}
		}(sceneID, projectID, filePath, h.DB, h.R2)
	}

	return c.JSON(project)
}

func (h *ProjectHandler) GetProjects(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	var projects []models.Project

	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "User not found"})
	}

	if user.IsAdmin {
		// Admin sees all public and active tours across the platform (Global Archives)
		h.DB.Preload("Scenes").Preload("User").Where("is_public = ? AND is_active = ?", true, true).Order("created_at desc").Find(&projects)
	} else {
		h.DB.Preload("Scenes").Preload("User").Where("user_id = ?", userID).Order("created_at desc").Find(&projects)
	}
	return c.JSON(projects)
}

func (h *ProjectHandler) GetProject(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(uint)

	var user models.User
	h.DB.First(&user, userID)

	var project models.Project
	// Preload both project-level hotspots (legacy) and scene-level hotspots (multi-scene)
	if err := h.DB.Preload("Hotspots").Preload("Scenes.Hotspots").Preload("User").Where("id = ?", id).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	if !user.IsAdmin && project.UserID != userID {
		if !project.IsPublic || !project.IsActive {
			return c.Status(403).JSON(fiber.Map{"error": "Unauthorized or Tour Inactive"})
		}
	}

	return c.JSON(project)
}
func (h *ProjectHandler) DeleteProject(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(uint)

	var project models.Project
	if err := h.DB.Where("id = ?", id).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	// Permission check: Admin can delete any, user can delete own
	var user models.User
	h.DB.First(&user, userID)
	if !user.IsAdmin && project.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}

	// Double check creative phase (Phase 1)
	if !user.IsAdmin && time.Now().After(user.ExpiresAt) {
		return c.Status(403).JSON(fiber.Map{"error": "Creative Phase expired. Only View-Only access is allowed. Contact A360 Workshop Team for extensions."})
	}

	// Delete record
	h.DB.Delete(&project)

	// Update user storage
	var projUser models.User
	if err := h.DB.First(&projUser, project.UserID).Error; err == nil {
		projUser.StorageUsed -= project.Size
		if projUser.StorageUsed < 0 {
			projUser.StorageUsed = 0
		}
		h.DB.Save(&projUser)
	}

	// Clean up files
	ctx := context.Background()
	if h.R2 != nil {
		h.R2.DeleteDirectory(ctx, id)
	} else {
		os.RemoveAll(project.PanoPath)
	}

	return c.JSON(fiber.Map{"message": "Project deleted"})
}

func (h *ProjectHandler) UpdateProject(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(uint)

	var project models.Project
	if err := h.DB.Where("id = ?", id).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	var user models.User
	h.DB.First(&user, userID)
	if !user.IsAdmin && project.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}

	// Double check creative phase (Phase 1)
	if !user.IsAdmin && time.Now().After(user.ExpiresAt) {
		return c.Status(403).JSON(fiber.Map{"error": "Creative Phase expired. Only View-Only access is allowed. Contact A360 Workshop Team for extensions."})
	}

	type UpdateRequest struct {
		Name     string `json:"name"`
		IsPublic bool   `json:"is_public"`
		IsActive bool   `json:"is_active"`
	}

	var req UpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update fields
	project.Name = req.Name

	// If visibility changed to public and no magic code, generate one
	if req.IsPublic && !project.IsPublic && project.MagicCode == "" {
		project.MagicCode = h.generateUniqueMagicCode()
	}
	project.IsPublic = req.IsPublic
	project.IsActive = req.IsActive

	h.DB.Save(&project)

	return c.JSON(project)
}

func (h *ProjectHandler) SaveHotspots(c *fiber.Ctx) error {
	sceneID := c.Params("sceneID")
	userID := c.Locals("user_id").(uint)

	var scene models.Scene
	if err := h.DB.Where("id = ?", sceneID).First(&scene).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Scene not found"})
	}

	var project models.Project
	h.DB.Where("id = ?", scene.ProjectID).First(&project)

	var user models.User
	h.DB.First(&user, userID)

	if !user.IsAdmin && project.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}

	if !user.IsAdmin && time.Now().After(user.ExpiresAt) {
		return c.Status(403).JSON(fiber.Map{"error": "Creative Phase expired."})
	}

	var req []models.Hotspot
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tx := h.DB.Begin()
	if err := tx.Where("scene_id = ?", sceneID).Delete(&models.Hotspot{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reset hotspots"})
	}

	for _, hs := range req {
		h := models.Hotspot{
			SceneID:          sceneID,
			ProjectID:        scene.ProjectID,
			Yaw:              hs.Yaw,
			Pitch:            hs.Pitch,
			Type:             hs.Type,
			Target:           hs.Target,
			TargetSceneID:    hs.TargetSceneID,
			Title:            hs.Title,
			Description:      hs.Description,
			ImageURL:         hs.ImageURL,
			AdditionalImages: hs.AdditionalImages,
			VideoURL:         hs.VideoURL,
		}
		if err := tx.Create(&h).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save hotspot"})
		}
	}

	tx.Commit()
	return c.JSON(fiber.Map{"message": "Hotspots updated", "count": len(req)})
}

func (h *ProjectHandler) SaveProjectHotspots(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(uint)

	var project models.Project
	if err := h.DB.Where("id = ?", id).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
	}

	var user models.User
	h.DB.First(&user, userID)

	if !user.IsAdmin && project.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}

	var req []models.Hotspot
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tx := h.DB.Begin()
	if err := tx.Where("project_id = ? AND (scene_id = '' OR scene_id IS NULL)", id).Delete(&models.Hotspot{}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reset legacy hotspots"})
	}

	for _, hs := range req {
		h := models.Hotspot{
			ProjectID:        id,
			Yaw:              hs.Yaw,
			Pitch:            hs.Pitch,
			Type:             hs.Type,
			Target:           hs.Target,
			TargetSceneID:    hs.TargetSceneID,
			Title:            hs.Title,
			Description:      hs.Description,
			ImageURL:         hs.ImageURL,
			AdditionalImages: hs.AdditionalImages,
			VideoURL:         hs.VideoURL,
		}
		if err := tx.Create(&h).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save hotspot"})
		}
	}

	tx.Commit()
	return c.JSON(fiber.Map{"message": "Project hotspots updated", "count": len(req)})
}

func (h *ProjectHandler) GetProjectByMagicCode(c *fiber.Ctx) error {
	code := c.Params("magicCode")
	var project models.Project
	if err := h.DB.Preload("Hotspots").Preload("Scenes.Hotspots").Preload("User").Where("magic_code = ? AND is_public = ? AND is_active = ?", code, true, true).First(&project).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Public tour not found or inactive"})
	}

	// Increment view count (throttled)
	if h.shouldIncrementView(c.IP(), project.ID) {
		h.DB.Model(&project).UpdateColumn("views", gorm.Expr("views + 1"))
	}

	return c.JSON(project)
}

func (h *ProjectHandler) UpdateScene(c *fiber.Ctx) error {
	sceneID := c.Params("sceneID")
	userID := c.Locals("user_id").(uint)

	// Permission check
	var scene models.Scene
	if err := h.DB.Where("id = ?", sceneID).First(&scene).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Scene not found"})
	}

	var project models.Project
	h.DB.Where("id = ?", scene.ProjectID).First(&project)

	var user models.User
	h.DB.First(&user, userID)

	if !user.IsAdmin && project.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}

	type UpdateRequest struct {
		Name string `json:"name"`
	}

	var req UpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	scene.Name = req.Name
	h.DB.Save(&scene)

	return c.JSON(scene)
}
func (h *ProjectHandler) UploadMedia(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	// Get user to check quota/permissions
	var user models.User
	if err := h.DB.First(&user, userID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "User not found"})
	}

	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Failed to parse form"})
	}

	files := form.File["files[]"]
	if len(files) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No files uploaded"})
	}

	// Check storage quota (simplified check for media)
	quotaMB, _ := strconv.ParseInt(os.Getenv("STORAGE_QUOTA_MB"), 10, 64)
	if quotaMB == 0 {
		quotaMB = 500
	}

	var totalSize int64
	for _, file := range files {
		totalSize += file.Size
	}

	if user.StorageUsed+totalSize > quotaMB*1024*1024 {
		return c.Status(403).JSON(fiber.Map{"error": "Storage quota exceeded"})
	}

	uploadPath := "./uploads/media"
	os.MkdirAll(uploadPath, 0755)

	var savedUrls []string
	ctx := context.Background()
	for _, file := range files {
		ext := filepath.Ext(file.Filename)
		newName := uuid.New().String() + ext
		filePath := filepath.Join(uploadPath, newName)
		if err := c.SaveFile(file, filePath); err != nil {
			continue
		}

		// Upload to R2
		if h.R2 != nil {
			key := fmt.Sprintf("media/%s", newName)
			err := h.R2.UploadFile(ctx, key, filePath, "image/jpeg") // Assuming image for now
			if err == nil {
				savedUrls = append(savedUrls, key)
				// Cleanup local
				os.Remove(filePath)
			}
		} else {
			savedUrls = append(savedUrls, fmt.Sprintf("uploads/media/%s", newName))
		}
	}

	// Update user storage
	user.StorageUsed += totalSize
	h.DB.Save(&user)

	return c.JSON(fiber.Map{"urls": savedUrls})
}
