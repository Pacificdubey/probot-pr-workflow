output "lambda_function_name" {
  value = aws_lambda_function.probot.function_name
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.http_api.api_endpoint
}
