package main

import (
	"log"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"a360-platform/backend/internal/models"
)

func main() {
	_ = godotenv.Load("../../.env") // Try root .env
	_ = godotenv.Load("../.env")    // Try backend .env

	dsn := "host=localhost user=user password=password dbname=a360db port=5432 sslmode=disable"

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}

	var users []models.User
	db.Find(&users)

	log.Printf("Found %d users. Recalculating storage...", len(users))

	for _, user := range users {
		var totalSize int64
		db.Model(&models.Project{}).Where("user_id = ?", user.ID).Select("SUM(size)").Row().Scan(&totalSize)

		log.Printf("User %s: Current %d, New %d", user.Email, user.StorageUsed, totalSize)

		db.Model(&user).Update("storage_used", totalSize)
	}

	log.Println("Storage cleanup complete.")
}
