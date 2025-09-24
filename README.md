# Overview

This is a Telegram bot application called "FL Solver Bot" built with Node.js. The bot is designed to interact with users on Telegram, currently implementing basic greeting functionality through the `/start` command. The project uses the `node-telegram-bot-api` library to handle Telegram Bot API interactions and is configured to run on Replit with environment-based token management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Bot Framework
- **Technology**: Node.js with `node-telegram-bot-api` library
- **Communication Pattern**: Polling-based message fetching from Telegram servers
- **Rationale**: Polling provides simplicity for deployment on platforms like Replit without requiring webhook setup

## Message Handling
- **Command Processing**: Text-based command parsing using regular expressions
- **Event-Driven Architecture**: Bot listens for specific events (commands, messages, errors)
- **Logging Strategy**: Console-based logging for all user interactions and system events

## Configuration Management
- **Environment Variables**: Bot token stored securely in environment variables
- **Error Handling**: Graceful startup failure if required configuration is missing
- **Security**: Token validation at startup to prevent runtime failures

## Error Management
- **Polling Error Handling**: Dedicated error handler for connection issues
- **Graceful Degradation**: Bot continues operating even if individual message processing fails
- **User Feedback**: Clear error messages for configuration issues

# External Dependencies

## Telegram Bot API
- **Service**: Official Telegram Bot API
- **Authentication**: Bot token-based authentication
- **Purpose**: Core messaging functionality and user interaction

## Node.js Runtime
- **Platform**: Node.js runtime environment
- **Package Management**: npm for dependency management
- **Main Library**: `node-telegram-bot-api` v0.66.0 for Telegram integration

## Deployment Platform
- **Environment**: Replit hosting platform
- **Configuration**: Environment variable-based token management
- **Scaling**: Single-instance polling-based deployment model