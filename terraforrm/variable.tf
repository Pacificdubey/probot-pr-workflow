variable "app_id" {
  description = "GitHub App ID"
  type        = string
}

variable "private_key" {
  description = "GitHub App private key"
  type        = string
}

variable "webhook_secret" {
  description = "Webhook secret"
  type        = string
}

variable "lambda_timeout" {
  description = "Timeout for the Lambda function in seconds"
  type        = number
  default     = 360  
}
