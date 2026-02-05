package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"a360-platform/backend/internal/auth"
	"a360-platform/backend/internal/mail"
	"a360-platform/backend/internal/models"
)

type AuthHandler struct {
	DB *gorm.DB
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	type Request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		FullName string `json:"full_name"`
		UserType string `json:"user_type"`
		Token    string `json:"token"`
		RegCode  string `json:"reg_code"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// 1. Check Invitation Token (Priority)
	var invitation models.Invitation
	var regCode models.RegistrationCode
	isInvite := false
	isRegCode := false

	if req.Token != "" {
		if err := h.DB.Where("token = ? AND is_used = ? AND expires_at > ?", req.Token, false, time.Now()).First(&invitation).Error; err == nil {
			isInvite = true
		}
	}

	// 2. Check Registration Code (Fallback/Alternative)
	if !isInvite && req.RegCode != "" {
		if err := h.DB.Where("code = ? AND is_active = ? AND expires_at > ? AND valid_from <= ?", req.RegCode, true, time.Now(), time.Now()).First(&regCode).Error; err == nil {
			// Check usage limit
			if regCode.MaxUsage == 0 || regCode.UsageCount < regCode.MaxUsage {
				isRegCode = true
			} else {
				return c.Status(400).JSON(fiber.Map{"error": "Registration code has reached maximum usage"})
			}
		}
	}

	if !isInvite && !isRegCode {
		return c.Status(400).JSON(fiber.Map{"error": "Valid invitation token or registration code is required"})
	}

	// SELF-HEALING: Check if a soft-deleted user exists with this email
	var existingUser models.User
	if err := h.DB.Unscoped().Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		if existingUser.DeletedAt.Valid {
			// Found a soft-deleted "ghost" record.
			// To allow re-registration, we MUST hard-delete the old record and its orphaned projects.
			h.DB.Unscoped().Where("user_id = ?", existingUser.ID).Delete(&models.Project{})
			h.DB.Unscoped().Delete(&existingUser)
		}
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)

	// Determine project limit and quota
	projectLimit := 3                        // Default
	storageQuota := int64(300 * 1024 * 1024) // Default 300MB
	isAdmin := false
	regSource := ""
	validFrom := time.Now()
	expiresAt := time.Now().AddDate(0, 0, 30) // Default 30 days for Creative Phase

	if isInvite {
		isAdmin = invitation.IsAdmin
		regSource = "Invitation"
		// Invitations use their own expiry
		validFrom = time.Now()
		expiresAt = invitation.ExpiresAt
	} else if isRegCode {
		projectLimit = regCode.ProjectLimit
		if regCode.StorageQuota > 0 {
			storageQuota = regCode.StorageQuota
		}
		regSource = "Code:" + regCode.Code
		// Seminar codes: Individual access starts upon registration
		validFrom = time.Now()
		expiresAt = validFrom.AddDate(0, 0, 30) // Fixed 30 days from registration for Creative Phase
	}

	user := models.User{
		Email:    req.Email,
		FullName: req.FullName,
		UserType: req.UserType,
		Password: string(hashedPassword),
		// Set default quota and non-admin status
		StorageQuota: storageQuota,
		ProjectLimit: projectLimit,
		IsAdmin:      isAdmin,
		RegSource:    regSource,
		ValidFrom:    validFrom,
		ExpiresAt:    expiresAt,
	}

	if err := h.DB.Create(&user).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Email already exists"})
	}

	// Finalize status
	if isInvite {
		h.DB.Model(&invitation).Update("is_used", true)
	} else if isRegCode {
		h.DB.Model(&regCode).Update("usage_count", regCode.UsageCount+1)
	}

	token, _ := auth.GenerateToken(user.ID)

	// Send Welcome Email
	_ = mail.SendWelcome(user.Email)

	return c.JSON(fiber.Map{"token": token, "user": user})
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	type Request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Total Lockout Check (Tiered Access: Phase 3 - After 90 days total)
	if !user.IsAdmin && time.Now().After(user.ExpiresAt.AddDate(0, 0, 60)) {
		return c.Status(403).JSON(fiber.Map{"error": "Account membership expired (90-day institutional limit reached). Please contact A360 Workshop Team for extensions."})
	}

	token, _ := auth.GenerateToken(user.ID)
	return c.JSON(fiber.Map{"token": token, "user": user})
}

func (h *AuthHandler) GetProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	var user models.User
	if err := h.DB.Preload("Projects").First(&user, userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(user)
}

func (h *AuthHandler) ForgotPassword(c *fiber.Ctx) error {
	type Request struct {
		Email string `json:"email"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Professional email not found in our records."})
	}

	// Cooldown Check: Prevent spamming reset requests (2 minute cooldown)
	if user.ResetExpires != nil {
		lastRequest := user.ResetExpires.Add(-1 * time.Hour)
		cooldownExpiry := lastRequest.Add(2 * time.Minute)
		if time.Now().Before(cooldownExpiry) {
			remaining := time.Until(cooldownExpiry).Seconds()
			return c.Status(429).JSON(fiber.Map{
				"error":     "Too many requests. Please wait before requesting another security key.",
				"remaining": int(remaining),
			})
		}
	}

	// Generate reset token
	b := make([]byte, 16)
	rand.Read(b)
	token := hex.EncodeToString(b)
	expires := time.Now().Add(1 * time.Hour)

	user.ResetToken = token
	user.ResetExpires = &expires
	h.DB.Save(&user)

	// Send Email
	if err := mail.SendResetPassword(user.Email, token); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send reset email"})
	}

	return c.JSON(fiber.Map{"message": "If an account exists with this email, a reset link will be sent."})
}

func (h *AuthHandler) ResetPassword(c *fiber.Ctx) error {
	type Request struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var user models.User
	if err := h.DB.Where("reset_token = ? AND reset_expires > ?", req.Token, time.Now()).First(&user).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid or expired reset token"})
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	user.Password = string(hashedPassword)
	user.ResetToken = ""
	user.ResetExpires = nil
	h.DB.Save(&user)

	return c.JSON(fiber.Map{"message": "Password updated successfully"})
}
