package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Email        string         `gorm:"unique;not null" json:"email"`
	FullName     string         `json:"full_name"`
	UserType     string         `json:"user_type"` // Student, Teacher/Professor, Anonymous
	Password     string         `gorm:"not null" json:"-"`
	StorageUsed  int64          `json:"storage_used"`  // in bytes
	StorageQuota int64          `json:"storage_quota"` // in bytes
	ProjectLimit int            `json:"project_limit"` // max number of projects
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	IsAdmin      bool           `gorm:"default:false" json:"is_admin"`
	Projects     []Project      `json:"projects,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	RegSource    string         `json:"reg_source"` // e.g. "Invitation", "Code:ABCDEF"
	ValidFrom    time.Time      `json:"valid_from"`
	ExpiresAt    time.Time      `json:"expires_at"`
	ResetToken   string         `json:"reset_token"`
	ResetExpires *time.Time     `json:"reset_expires"`
}

type Project struct {
	ID        string         `gorm:"primaryKey;type:uuid" json:"id"`
	UserID    uint           `json:"user_id"`
	Name      string         `json:"name"`
	PanoPath  string         `json:"pano_path"`
	IsPublic  bool           `gorm:"default:false" json:"is_public"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	MagicCode string         `gorm:"uniqueIndex" json:"magic_code"` // Short unique code for public tours
	Manifest  string         `gorm:"type:text" json:"manifest"`     // JSON string for hotspots
	Size      int64          `json:"size"`                          // storage size in bytes
	Hotspots  []Hotspot      `json:"hotspots"`
	User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Status    string         `gorm:"default:'ready'" json:"status"` // ready, processing, error
	Views     int64          `gorm:"default:0" json:"views"`
	Scenes    []Scene        `json:"scenes"`
}

type Scene struct {
	ID           string         `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID    string         `gorm:"index" json:"project_id"`
	Name         string         `json:"name"`
	PanoPath     string         `json:"pano_path"`
	Status       string         `gorm:"default:'ready'" json:"status"` // ready, processing, error
	DisplayOrder int            `json:"display_order"`
	Size         int64          `json:"size"`
	Hotspots     []Hotspot      `json:"hotspots"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type Hotspot struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	ProjectID        string    `json:"project_id"`
	SceneID          string    `gorm:"index" json:"scene_id"`
	Yaw              float64   `json:"yaw"`
	Pitch            float64   `json:"pitch"`
	Type             string    `gorm:"default:'info'" json:"type"` // info, scene
	Target           string    `json:"target"`                     // Can be "scene:ID" or info text
	TargetSceneID    string    `json:"target_scene_id"`            // Explicit link to another scene
	Title            string    `json:"title"`
	Description      string    `gorm:"type:text" json:"description"`
	ImageURL         string    `json:"image_url"`
	AdditionalImages string    `gorm:"type:text" json:"additional_images"` // JSON array of strings
	VideoURL         string    `json:"video_url"`
	CreatedAt        time.Time `json:"created_at"`
}

type Invitation struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Email     string         `gorm:"unique;not null" json:"email"`
	Token     string         `gorm:"unique;not null" json:"token"`
	IsUsed    bool           `gorm:"default:false" json:"is_used"`
	IsAdmin   bool           `gorm:"default:false" json:"is_admin"`
	ExpiresAt time.Time      `json:"expires_at"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
type RegistrationCode struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Code         string         `gorm:"unique;not null" json:"code"`
	Description  string         `json:"description"`
	UsageCount   int            `gorm:"default:0" json:"usage_count"`
	MaxUsage     int            `gorm:"default:0" json:"max_usage"` // 0 for unlimited
	ProjectLimit int            `gorm:"default:3" json:"project_limit"`
	StorageQuota int64          `json:"storage_quota"` // in bytes
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	ValidFrom    time.Time      `json:"valid_from"`
	ExpiresAt    time.Time      `json:"expires_at"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	AdminID   uint      `json:"admin_id"`
	Action    string    `json:"action"` // e.g. "Update User", "Toggle Admin"
	Target    string    `json:"target"` // e.g. "User: student@example.com"
	Details   string    `gorm:"type:text" json:"details"`
	CreatedAt time.Time `json:"created_at"`
}
