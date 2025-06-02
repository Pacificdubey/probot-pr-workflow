resource "aws_api_gateway_rest_api" "probot_api" {
  name = "probot-api"
}

resource "aws_api_gateway_resource" "api" {
  rest_api_id = aws_api_gateway_rest_api.probot_api.id
  parent_id   = aws_api_gateway_rest_api.probot_api.root_resource_id
  path_part   = "api"
}

resource "aws_api_gateway_resource" "github" {
  rest_api_id = aws_api_gateway_rest_api.probot_api.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "github"
}

resource "aws_api_gateway_resource" "webhook" {
  rest_api_id = aws_api_gateway_rest_api.probot_api.id
  parent_id   = aws_api_gateway_resource.github.id
  path_part   = "webhook"
}


resource "aws_api_gateway_method" "webhook_post" {
  rest_api_id   = aws_api_gateway_rest_api.probot_api.id
  resource_id   = aws_api_gateway_resource.webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_proxy" {
  rest_api_id             = aws_api_gateway_rest_api.probot_api.id
  resource_id             = aws_api_gateway_resource.webhook.id
  http_method             = aws_api_gateway_method.webhook_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.probot.invoke_arn
}

resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.probot.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.probot_api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "deployment" {
  depends_on = [aws_api_gateway_integration.lambda_proxy]
  rest_api_id = aws_api_gateway_rest_api.probot_api.id
}

resource "aws_api_gateway_stage" "probot_stage" {
  rest_api_id    = aws_api_gateway_rest_api.probot_api.id
  deployment_id  = aws_api_gateway_deployment.deployment.id
  stage_name     = "dev"
}
