variable "lambda_timeout" {
  description = "Timeout for the Lambda function in seconds"
  type        = number
  default     = 360  
}

variable "app_id" {
  description = "GitHub App ID"
  type        = string
  sensitive = true
}

variable "webhook_secret" {
  description = "GitHub webhook secret"
  type        = string
  sensitive = true
}

# variable "private_key" {
#   description = "GitHub App private key"
#   type        = string
#   sensitive = true
# }
