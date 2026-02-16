package main

import (
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"a360-platform/backend/internal/auth"
	"a360-platform/backend/internal/handlers"
	"a360-platform/backend/internal/models"
	"a360-platform/backend/internal/s3"
)

func main() {
	// Load .env
	_ = godotenv.Load()

	// DB Connection with Retries
	dsn := "host=" + os.Getenv("DB_HOST") +
		" user=" + os.Getenv("DB_USER") +
		" password=" + os.Getenv("DB_PASSWORD") +
		" dbname=" + os.Getenv("DB_NAME") +
		" port=" + os.Getenv("DB_PORT") +
		" sslmode=disable TimeZone=Asia/Bangkok"

	var db *gorm.DB
	var err error
	for i := 0; i < 10; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		log.Printf("Connecting to database... attempt %d/10 failed. Retrying in 2s...", i+1)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatal("Failed to connect to database after 10 attempts:", err)
	}

	// Auto-migrate
	db.AutoMigrate(&models.User{}, &models.Project{}, &models.Scene{}, &models.Hotspot{}, &models.Invitation{}, &models.RegistrationCode{}, &models.AuditLog{})

	// SELF-HEALING: Populate ValidFrom and ExpiresAt for existing users
	db.Model(&models.User{}).Where("valid_from = ? OR valid_from IS NULL", time.Time{}).Update("valid_from", gorm.Expr("created_at"))
	db.Model(&models.User{}).Where("expires_at = ? OR expires_at IS NULL", time.Time{}).Update("expires_at", gorm.Expr("created_at + interval '30 days'"))

	// Update existing users with 0 or NULL project limit/quota to defaults
	db.Model(&models.User{}).Where("project_limit IS NULL OR project_limit = 0").Update("project_limit", 3)
	db.Model(&models.User{}).Where("storage_quota IS NULL OR storage_quota = 0").Update("storage_quota", 500*1024*1024)

	// Auto-heal storage usage
	var users []models.User
	db.Find(&users)
	for _, user := range users {
		var totalSize int64
		db.Model(&models.Project{}).Where("user_id = ?", user.ID).Select("SUM(size)").Row().Scan(&totalSize)
		db.Model(&user).Update("storage_used", totalSize)
	}

	// SELF-HEALING: Populate ValidFrom and ExpiresAt for existing registration codes
	db.Model(&models.RegistrationCode{}).Where("valid_from = ? OR valid_from IS NULL", time.Time{}).Update("valid_from", gorm.Expr("created_at"))
	db.Model(&models.RegistrationCode{}).Where("expires_at = ? OR expires_at IS NULL", time.Time{}).Update("expires_at", gorm.Expr("created_at + interval '12 months'"))

	app := fiber.New(fiber.Config{
		BodyLimit: 1024 * 1024 * 1024, // 1GB for large pano/media uploads
	})

	app.Use(logger.New())
	app.Use(cors.New())
	app.Use(recover.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	// Setup Handlers
	r2Service, _ := s3.NewR2Service()
	authHandler := handlers.AuthHandler{DB: db}
	projectHandler := handlers.ProjectHandler{DB: db, R2: r2Service}
	adminHandler := handlers.AdminHandler{DB: db}

	api := app.Group("/api")

	// Auth routes with Rate Limiting for Login
	loginLimiter := limiter.New(limiter.Config{
		Max:        5,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(429).JSON(fiber.Map{
				"error": "Too many login attempts. Please wait 1 minute before trying again.",
			})
		},
	})

	authGroup := api.Group("/auth")
	authGroup.Post("/register", authHandler.Register)
	authGroup.Post("/login", loginLimiter, authHandler.Login)
	authGroup.Post("/forgot-password", authHandler.ForgotPassword)
	authGroup.Post("/reset-password", authHandler.ResetPassword)
	authGroup.Get("/invitation-details", authHandler.GetInvitationDetails)
	authGroup.Get("/me", auth.JWTMiddleware(), authHandler.GetProfile)

	// Admin routes (Protected)
	adminGroup := api.Group("/admin", auth.JWTMiddleware(), auth.AdminMiddleware(db))
	adminGroup.Post("/invite", adminHandler.CreateInvitation)
	adminGroup.Get("/users", adminHandler.ListUsers)
	adminGroup.Patch("/users/:id/toggle-admin", adminHandler.ToggleAdmin)
	adminGroup.Patch("/users/:id/toggle-active", adminHandler.ToggleActive)
	adminGroup.Patch("/users/:id", adminHandler.UpdateUser)
	adminGroup.Delete("/users/:id", adminHandler.DeleteUser)
	adminGroup.Get("/audit-logs", adminHandler.GetAuditLogs)
	adminGroup.Post("/reg-codes", adminHandler.CreateRegistrationCode)
	adminGroup.Get("/reg-codes", adminHandler.ListRegistrationCodes)
	adminGroup.Delete("/reg-codes/:id", adminHandler.DeleteRegistrationCode)
	adminGroup.Patch("/reg-codes/:id/toggle", adminHandler.ToggleRegistrationCode)
	adminGroup.Get("/stats", adminHandler.GetStats)
	adminGroup.Post("/recalculate-storage", adminHandler.RecalculateStorage)
	adminGroup.Get("/invitations", adminHandler.ListInvitations)
	adminGroup.Delete("/invitations/:id", adminHandler.DeleteInvitation)

	// Protected routes
	projectGroup := api.Group("/projects", auth.JWTMiddleware())
	projectGroup.Post("/upload", projectHandler.UploadPano)
	projectGroup.Get("/", projectHandler.GetProjects)
	projectGroup.Get("/:id", projectHandler.GetProject)
	projectGroup.Put("/:id", projectHandler.UpdateProject)
	projectGroup.Delete("/:id", projectHandler.DeleteProject)
	projectGroup.Post("/:id/hotspots", projectHandler.SaveProjectHotspots)
	projectGroup.Post("/scenes/:sceneID/hotspots", projectHandler.SaveHotspots)
	projectGroup.Post("/media", projectHandler.UploadMedia)
	projectGroup.Put("/scenes/:sceneID", projectHandler.UpdateScene)

	// Public access route for tours
	api.Get("/magic/:magicCode", projectHandler.GetProjectByMagicCode)

	app.Static("/uploads", "./uploads")

	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

	log.Fatal(app.Listen(":" + port))
}
