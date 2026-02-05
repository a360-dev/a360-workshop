package pipeline

import (
	"image"
	"math"
	"os"
	"path/filepath"

	"github.com/disintegration/imaging"
)

// ExtractFace extracts one face of a cubemap from an equirectangular panorama
func ExtractFace(input image.Image, face int, faceSize int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, faceSize, faceSize))

	for y := 0; y < faceSize; y++ {
		for x := 0; x < faceSize; x++ {
			// Normalize cube coordinates to [-1, 1]
			u := 2.0*float64(x)/float64(faceSize) - 1.0
			v := 2.0*float64(y)/float64(faceSize) - 1.0

			var vx, vy, vz float64
			switch face {
			case 0: // Right (+X)
				vx, vy, vz = 1.0, -v, -u
			case 1: // Left (-X)
				vx, vy, vz = -1.0, -v, u
			case 2: // Top (+Y)
				vx, vy, vz = u, 1.0, v
			case 3: // Bottom (-Y)
				vx, vy, vz = u, -1.0, -v
			case 4: // Front (+Z)
				vx, vy, vz = u, -v, 1.0
			case 5: // Back (-Z)
				vx, vy, vz = -u, -v, -1.0
			}

			// Convert unit vector to spherical coordinates
			phi := math.Atan2(vx, vz)
			theta := math.Atan2(vy, math.Sqrt(vx*vx+vz*vz))

			// Map to equirectangular coordinates
			srcX := (phi/(2*math.Pi) + 0.5) * float64(input.Bounds().Dx())
			srcY := (0.5 - theta/math.Pi) * float64(input.Bounds().Dy())

			// Billinear interpolation could be added here, but for now just pick nearest
			c := input.At(int(srcX), int(srcY))
			img.Set(x, y, c)
		}
	}
	return img
}

func SlicePano(inputPath string, outputDir string) ([]string, error) {
	src, err := imaging.Open(inputPath)
	if err != nil {
		return nil, err
	}

	// For equirectangular 2:1, cube faces are roughly Width / 4
	faceSize := src.Bounds().Dx() / 4
	faces := []string{"posx", "negx", "posy", "negy", "posz", "negz"}
	var paths []string

	if _, err := os.Stat(outputDir); os.IsNotExist(err) {
		os.MkdirAll(outputDir, 0755)
	}

	for i, name := range faces {
		faceImg := ExtractFace(src, i, faceSize)
		path := filepath.Join(outputDir, name+".jpg")
		err := imaging.Save(faceImg, path)
		if err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}

	// Generate Thumbnail from Front Face (posz.jpg)
	frontFacePath := filepath.Join(outputDir, "posz.jpg")
	frontImg, err := imaging.Open(frontFacePath)
	if err == nil {
		uploadPath := filepath.Dir(outputDir)
		thumb := imaging.Fill(frontImg, 512, 512, imaging.Center, imaging.Lanczos)
		imaging.Save(thumb, filepath.Join(uploadPath, "thumbnail.jpg"))
	}

	return paths, nil
}
