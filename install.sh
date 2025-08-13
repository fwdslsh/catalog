#!/bin/bash

# Catalog Installation Script
# This script is a wrapper that calls the universal fwdslsh installer from the toolkit repository

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
TOOL_NAME="catalog"
INSTALLER_URL="https://raw.githubusercontent.com/fwdslsh/toolkit/main/install.sh"

# Function to print colored messages
log_info() {
    printf "${BLUE}[INFO]${NC} %s\n" "$1"
}

log_error() {
    printf "${RED}[ERROR]${NC} %s\n" "$1"
}

log_success() {
    printf "${GREEN}[SUCCESS]${NC} %s\n" "$1"
}

# Check if curl or wget is available
check_download_tool() {
    if command -v curl >/dev/null 2>&1; then
        echo "curl"
    elif command -v wget >/dev/null 2>&1; then
        echo "wget"
    else
        log_error "Neither curl nor wget is available. Please install one of them."
        echo "  Ubuntu/Debian: sudo apt-get install curl"
        echo "  macOS: curl is pre-installed or use: brew install curl"
        echo "  RHEL/Fedora: sudo yum install curl"
        exit 1
    fi
}

# Main function
main() {
    log_info "Starting installation of ${TOOL_NAME}..."
    
    # Detect download tool
    DOWNLOAD_TOOL=$(check_download_tool)
    
    # Pass all arguments to the universal installer, prepending the tool name
    if [[ "$DOWNLOAD_TOOL" == "curl" ]]; then
        log_info "Downloading and executing universal installer..."
        curl -fsSL "$INSTALLER_URL" | bash -s -- "$TOOL_NAME" "$@"
        RESULT=$?
    else
        log_info "Downloading and executing universal installer..."
        wget -qO- "$INSTALLER_URL" | bash -s -- "$TOOL_NAME" "$@"
        RESULT=$?
    fi
    
    # Check result
    if [[ $RESULT -eq 0 ]]; then
        log_success "Installation completed successfully!"
    else
        log_error "Installation failed with exit code: $RESULT"
        exit $RESULT
    fi
}

# Show help if requested
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    cat << EOF
Catalog Installation Script

This is a wrapper script that installs catalog using the fwdslsh universal installer.

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --help              Show this help message
    --version TAG       Install specific version (e.g., v0.0.7)
    --dir PATH          Custom installation directory
    --global            Install globally (system-wide), requires sudo
    --force             Force reinstall even if already installed
    --dry-run           Show what would be done without installing

EXAMPLES:
    $0                           # Install latest version to ~/.local/bin
    $0 --version v0.0.7          # Install specific version
    $0 --dir /opt/bin --force    # Force install to custom directory
    $0 --dry-run                 # Preview installation

For more options and details, the universal installer will be called with your arguments.

Universal Installer: $INSTALLER_URL
EOF
    exit 0
fi

# Run main function with all arguments
main "$@"