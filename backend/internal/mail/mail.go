package mail

import (
	"fmt"
	"net/smtp"
	"os"
)

func SendInvitation(toEmail, token string) error {
	from := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASSWORD")
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	// Sender metadata
	senderName := "A360 Workshop Platform"
	displayEmail := "noreply@a360.co.th"
	subject := "Welcome to A360! | Invitation to join our Virtual Tour Platform"

	// Base URL for registration (pointing to frontend)
	baseURL := os.Getenv("FRONTEND_URL")
	if baseURL == "" {
		baseURL = "http://localhost:5173"
	}
	inviteLink := fmt.Sprintf("%s/register?token=%s", baseURL, token)

	// HTML Body with custom From display
	body := fmt.Sprintf("MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n"+
		"From: %s <%s>\r\n"+
		"Reply-To: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"\r\n"+
		"<html><body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">"+
		"<h2>Hello!</h2>"+
		"<p>You've been invited to join the <strong>A360 Workshop Platform</strong>, where we are building the future of immersive workshops and virtual archives.</p>"+
		"<p>To get started and set up your account, please click the link below:</p>"+
		"<p><a href=\"%s\" style=\"display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;\">Register for A360</a></p>"+
		"<p style=\"margin-top: 20px;\"><strong>A few things to note:</strong></p>"+
		"<ul>"+
		"<li><strong>Expiration:</strong> This link will expire in 24 hours for your security.</li>"+
		"<li><strong>Access:</strong> Once registered, you'll be able to access the Studio to begin creating your first virtual tours.</li>"+
		"</ul>"+
		"<p>If you weren't expecting this invitation, you can safely ignore this email.</p>"+
		"<p>Best regards,<br><strong>%s</strong></p>"+
		"</body></html>", senderName, displayEmail, displayEmail, toEmail, subject, inviteLink, senderName)

	auth := smtp.PlainAuth("", from, password, smtpHost)

	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{toEmail}, []byte(body))
	if err != nil {
		return err
	}
	return nil
}
func SendWelcome(toEmail string) error {
	from := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASSWORD")
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	senderName := "A360 Workshop Platform"
	displayEmail := "noreply@a360.co.th"
	subject := "Welcome to A360! | Account Created Successfully"

	body := fmt.Sprintf("MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n"+
		"From: %s <%s>\r\n"+
		"Reply-To: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"\r\n"+
		"<html><body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">"+
		"<h2>Welcome to A360 Workshop Platform!</h2>"+
		"<p>Your institutional account has been successfully created. We are excited to have you join our immersive archive!</p>"+
		"<p><strong>Institutional Access Terms:</strong></p>"+
		"<ul>"+
		"<li><strong>Workshop Duration (30 Days):</strong> You have full access to create, edit, and upload new virtual tours.</li>"+
		"<li><strong>View-Only Phase (Next 60 Days):</strong> After your workshop expires, you can still view and share your existing tours for an additional 60 days. Access to creation tools will be disabled.</li>"+
		"<li><strong>Final Lockout (After 90 Days):</strong> Your account will be locked after 90 days of total membership.</li>"+
		"</ul>"+
		"<p>If you wish to extend your license or have any questions, please contact the <strong>A360 Workshop Team</strong>.</p>"+
		"<p>Best regards,<br><strong>%s</strong></p>"+
		"</body></html>", senderName, displayEmail, displayEmail, toEmail, subject, senderName)

	auth := smtp.PlainAuth("", from, password, smtpHost)
	return smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{toEmail}, []byte(body))
}

func SendResetPassword(toEmail, token string) error {
	from := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASSWORD")
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	senderName := "A360 Workshop Platform"
	displayEmail := "noreply@a360.co.th"
	subject := "Reset Your A360 Password"

	baseURL := os.Getenv("FRONTEND_URL")
	if baseURL == "" {
		baseURL = "http://localhost:5173"
	}
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", baseURL, token)

	body := fmt.Sprintf("MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n"+
		"From: %s <%s>\r\n"+
		"Reply-To: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"\r\n"+
		"<html><body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">"+
		"<h2>Password Reset Request</h2>"+
		"<p>We received a request to reset your password for your A360 account.</p>"+
		"<p>Click the button below to set a new password:</p>"+
		"<p><a href=\"%s\" style=\"display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;\">Reset Password</a></p>"+
		"<p style=\"margin-top: 20px;\">This link will expire in 1 hour for your security.</p>"+
		"<p>If you did not request a password reset, you can safely ignore this email.</p>"+
		"<p>Best regards,<br><strong>%s</strong></p>"+
		"</body></html>", senderName, displayEmail, displayEmail, toEmail, subject, resetLink, senderName)

	auth := smtp.PlainAuth("", from, password, smtpHost)
	return smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{toEmail}, []byte(body))
}
