package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"a360-platform/backend/internal/mail"
	"a360-platform/backend/internal/models"
)

type AdminHandler struct {
	DB *gorm.DB
}

func (h *AdminHandler) logAdminAction(adminID uint, action, target, details string) {
	logEntry := models.AuditLog{
		AdminID:   adminID,
		Action:    action,
		Target:    target,
		Details:   details,
		CreatedAt: time.Now(),
	}
	h.DB.Create(&logEntry)
}

func (h *AdminHandler) CreateInvitation(c *fiber.Ctx) error {
	type Request struct {
		Email   string `json:"email"`
		IsAdmin bool   `json:"is_admin"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Check if user is already registered
	var existingUser models.User
	if err := h.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "User is already registered"})
	}

	// Generate random token
	b := make([]byte, 16)
	rand.Read(b)
	token := hex.EncodeToString(b)

	invitation := models.Invitation{
		Email:     req.Email,
		Token:     token,
		IsAdmin:   req.IsAdmin,
		ExpiresAt: time.Now().AddDate(0, 3, 0), // 3 months expiry
	}

	if err := h.DB.Create(&invitation).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invitation already exists or invalid email"})
	}

	// Send Email
	if err := mail.SendInvitation(req.Email, token); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send invitation email: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Invitation sent successfully", "token": token})
}

func (h *AdminHandler) ListUsers(c *fiber.Ctx) error {
	search := c.Query("search")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset := (page - 1) * limit

	var users []models.User
	query := h.DB.Model(&models.User{})

	if search != "" {
		query = query.Where("email ILIKE ?", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	if err := query.Preload("Projects").Order("created_at desc").Offset(offset).Limit(limit).Find(&users).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch users"})
	}

	return c.JSON(fiber.Map{
		"users": users,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *AdminHandler) GetStats(c *fiber.Ctx) error {
	var totalUsers int64
	var totalCodes int64
	var activeCodes int64
	var totalSpace int64

	h.DB.Model(&models.User{}).Count(&totalUsers)
	h.DB.Model(&models.RegistrationCode{}).Count(&totalCodes)
	h.DB.Model(&models.RegistrationCode{}).Where("is_active = ? AND expires_at > ?", true, time.Now()).Count(&activeCodes)
	h.DB.Model(&models.User{}).Select("SUM(storage_used)").Row().Scan(&totalSpace)

	return c.JSON(fiber.Map{
		"total_users":  totalUsers,
		"total_codes":  totalCodes,
		"active_codes": activeCodes,
		"total_space":  totalSpace,
	})
}

func (h *AdminHandler) ListInvitations(c *fiber.Ctx) error {
	var invitations []models.Invitation
	h.DB.Order("created_at desc").Find(&invitations)
	return c.JSON(invitations)
}

func (h *AdminHandler) DeleteInvitation(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.DB.Unscoped().Delete(&models.Invitation{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete invitation"})
	}

	adminID := c.Locals("user_id").(uint)
	h.logAdminAction(adminID, "Delete Invitation", "ID: "+id, "")

	return c.JSON(fiber.Map{"message": "Invitation deleted"})
}

func (h *AdminHandler) DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	var user models.User
	if err := h.DB.First(&user, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Safety: Don't allow an admin to delete themselves via this endpoint
	// (though frontend usually prevents it)
	adminID := c.Locals("user_id").(uint)
	if adminID == user.ID {
		return c.Status(400).JSON(fiber.Map{"error": "You cannot delete your own account"})
	}

	// 1. Find all projects to clean up files
	var projects []models.Project
	h.DB.Where("user_id = ?", user.ID).Find(&projects)

	// 2. Perform deletion in a transaction for safety
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		// Purge hotspots for these projects
		for _, p := range projects {
			tx.Unscoped().Where("project_id = ?", p.ID).Delete(&models.Hotspot{})
		}

		// Purge projects
		if err := tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.Project{}).Error; err != nil {
			return err
		}

		// Purge user
		if err := tx.Unscoped().Delete(&user).Error; err != nil {
			return err
		}

		// Purge invitation
		tx.Unscoped().Where("email = ?", user.Email).Delete(&models.Invitation{})

		return nil
	})

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete user and data"})
	}

	h.logAdminAction(adminID, "Delete User", user.Email, "Full data purge")

	// 3. Clean up physical files AFTER successful DB transaction
	for _, p := range projects {
		os.RemoveAll(p.PanoPath)
	}

	return c.JSON(fiber.Map{"message": "User and all associated data deleted permanently"})
}

func (h *AdminHandler) CreateRegistrationCode(c *fiber.Ctx) error {
	type Request struct {
		Code         string `json:"code"`
		Description  string `json:"description"`
		MaxUsage     int    `json:"max_usage"`
		ProjectLimit int    `json:"project_limit"`
		StorageQuota int64  `json:"storage_quota"`
		ExpiryMonths int    `json:"expiry_months"` // 3, 6, 12
		IsActive     bool   `json:"is_active"`
		ValidFrom    string `json:"valid_from"` // ISO string
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if len(req.Code) > 6 {
		return c.Status(400).JSON(fiber.Map{"error": "Code must be 6 characters maximum"})
	}

	validFrom := time.Now()
	if req.ValidFrom != "" {
		if t, err := time.Parse(time.RFC3339, req.ValidFrom); err == nil {
			validFrom = t
		}
	}

	expiryDate := validFrom
	if req.ExpiryMonths > 0 {
		expiryDate = expiryDate.AddDate(0, req.ExpiryMonths, 0)
	} else {
		// Default to 3 months as requested if not specified
		expiryDate = expiryDate.AddDate(0, 3, 0)
	}

	regCode := models.RegistrationCode{
		Code:         req.Code,
		Description:  req.Description,
		MaxUsage:     req.MaxUsage,
		ProjectLimit: req.ProjectLimit,
		StorageQuota: req.StorageQuota,
		IsActive:     req.IsActive,
		ValidFrom:    validFrom,
		ExpiresAt:    expiryDate,
	}

	if err := h.DB.Create(&regCode).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Code already exists or invalid data"})
	}

	adminID := c.Locals("user_id").(uint)
	h.logAdminAction(adminID, "Create Registration Code", regCode.Code, regCode.Description)

	return c.JSON(regCode)
}

func (h *AdminHandler) ListRegistrationCodes(c *fiber.Ctx) error {
	var codes []models.RegistrationCode
	h.DB.Find(&codes)
	return c.JSON(codes)
}

func (h *AdminHandler) DeleteRegistrationCode(c *fiber.Ctx) error {
	id := c.Params("id")
	var code models.RegistrationCode
	if err := h.DB.First(&code, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Code not found"})
	}

	if code.UsageCount > 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot delete a registration code that has already been used"})
	}

	if err := h.DB.Delete(&code).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete registration code"})
	}

	adminID := c.Locals("user_id").(uint)
	h.logAdminAction(adminID, "Delete Registration Code", code.Code, "")

	return c.JSON(fiber.Map{"message": "Registration code deleted"})
}
func (h *AdminHandler) ToggleRegistrationCode(c *fiber.Ctx) error {
	id := c.Params("id")
	var code models.RegistrationCode
	if err := h.DB.First(&code, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Code not found"})
	}

	code.IsActive = !code.IsActive
	h.DB.Save(&code)

	adminID := c.Locals("user_id").(uint)
	h.logAdminAction(adminID, "Toggle Registration Code", code.Code, fmt.Sprintf("Active: %v", code.IsActive))

	return c.JSON(code)
}

func (h *AdminHandler) ToggleActive(c *fiber.Ctx) error {
	id := c.Params("id")
	var user models.User
	if err := h.DB.First(&user, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if user.Email == "admin@example.com" {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot deactivate super admin"})
	}

	user.IsActive = !user.IsActive
	h.DB.Save(&user)

	adminID := c.Locals("user_id").(uint)
	status := "deactivated"
	if user.IsActive {
		status = "activated"
	}
	h.logAdminAction(adminID, "Toggle User Status", user.Email, fmt.Sprintf("Account %s", status))

	return c.JSON(user)
}
func (h *AdminHandler) ToggleAdmin(c *fiber.Ctx) error {
	id := c.Params("id")
	var user models.User
	if err := h.DB.First(&user, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	user.IsAdmin = !user.IsAdmin
	h.DB.Save(&user)

	adminID := c.Locals("user_id").(uint)
	h.logAdminAction(adminID, "Toggle User Admin", user.Email, fmt.Sprintf("IsAdmin: %v", user.IsAdmin))

	return c.JSON(user)
}

func (h *AdminHandler) UpdateUser(c *fiber.Ctx) error {
	id := c.Params("id")
	var user models.User
	if err := h.DB.First(&user, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	type Request struct {
		FullName     string `json:"full_name"`
		UserType     string `json:"user_type"`
		StorageQuota int64  `json:"storage_quota"`
		ProjectLimit int    `json:"project_limit"`
		ValidFrom    string `json:"valid_from"`
		ExpiresAt    string `json:"expires_at"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.ValidFrom != "" {
		if t, err := time.Parse(time.RFC3339, req.ValidFrom); err == nil {
			user.ValidFrom = t
		}
	}
	if req.ExpiresAt != "" {
		if t, err := time.Parse(time.RFC3339, req.ExpiresAt); err == nil {
			user.ExpiresAt = t
		}
	}

	if req.FullName != "" {
		user.FullName = req.FullName
	}
	if req.UserType != "" {
		user.UserType = req.UserType
	}

	if req.ProjectLimit > 0 {
		user.ProjectLimit = req.ProjectLimit
	}
	if req.StorageQuota > 0 {
		user.StorageQuota = req.StorageQuota
	}

	h.DB.Save(&user)

	adminID := c.Locals("user_id").(uint)
	h.logAdminAction(adminID, "Update User", user.Email, "Limits/Expiry adjusted")

	return c.JSON(user)
}

func (h *AdminHandler) RecalculateStorage(c *fiber.Ctx) error {
	var users []models.User
	h.DB.Find(&users)

	for _, user := range users {
		var totalSize int64
		h.DB.Model(&models.Project{}).Where("user_id = ?", user.ID).Select("SUM(size)").Row().Scan(&totalSize)
		h.DB.Model(&user).Update("storage_used", totalSize)
	}

	return c.JSON(fiber.Map{"message": "Storage stats recalculated for all users"})
}

func (h *AdminHandler) GetAuditLogs(c *fiber.Ctx) error {
	var logs []models.AuditLog
	h.DB.Order("created_at desc").Limit(100).Find(&logs)
	return c.JSON(logs)
}
