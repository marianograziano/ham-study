#!/bin/bash

echo "[AGENTS-MD] Bootstrapping Environment..."

# Check for uv
if ! command -v uv &> /dev/null; then
    echo "[AGENTS-MD] 'uv' not found. Installing..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install uv. Please install manually."
        exit 1
    fi
    
    # Source the env to get uv in path immediately if possible, 
    # though usually requires shell restart or sourcing .cargo/env
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    fi
fi

# Check for Node.js
if ! command -v node &> /dev/null && ! command -v nodejs &> /dev/null; then
    echo "[WARNING] Node.js not found. BMad-Method will run in degraded mode."
    echo "          Install Node.js v20+ for full functionality."
fi



# Function to create PROJECT_STATUS.md (must be defined before use)
create_status() {
    local mode=$1
    local current_date=$(date +%Y-%m-%d)
    
    cat <<EOF > PROJECT_STATUS.md
# PROJECT_STATUS.md

## ⚙️ Project Governance

### Governance Mode

**Current Mode**: \`$mode\` ✅

**Mode Definitions**:

- **Frozen**: 严格保持现有依赖版本,不做任何升级
- **Hybrid** ✅: 新文件使用现代标准,修改旧文件时保持原有风格
- **Aggressive**: 主动提议现代化重构和依赖升级

**Selection Date**: $current_date  
**Selected By**: User (Setup Script)

---

## 📋 Architectural Decision Records (ADR)

### ADR-001: 初始化治理模式为 $mode

- **Date**: $current_date
- **Status**: Accepted
- **Context**: 项目首次初始化,需要选择治理模式
- **Decision**: 选择 $mode 模式作为治理策略

---

## 📝 Last Task Summary

**Task**: Project Initialization  
**Date**: $current_date  
**Status**: Completed  
**Summary**: 环境设置完成,治理模式已选择
EOF
    
    echo "[OK] PROJECT_STATUS.md created with $mode mode"
}

# Mark environment as verified
touch .ag_env_verified

# Check for PROJECT_STATUS.md
if [ ! -f "PROJECT_STATUS.md" ]; then
    echo ""
    echo "========================================================"
    echo "[AGENTS-MD] First-time setup detected."
    echo "========================================================"
    echo ""
    echo "Please select a Governance Mode:"
    echo ""
    echo "  [1] Frozen     - Strict version control, no upgrades"
    echo "  [2] Hybrid     - Balance stability and innovation (Recommended)"
    echo "  [3] Aggressive - Proactive modernization"
    echo ""
    read -p "Enter your choice (1/2/3) [Default: 2]: " mode
    
    # Default to 2 if empty
    mode=${mode:-2}
    
    case $mode in
        1)
            echo ""
            echo "[AGENTS-MD] Creating PROJECT_STATUS.md with Frozen mode..."
            create_status "Frozen"
            ;;
        2)
            echo ""
            echo "[AGENTS-MD] Creating PROJECT_STATUS.md with Hybrid mode..."
            create_status "Hybrid"
            ;;
        3)
            echo ""
            echo "[AGENTS-MD] Creating PROJECT_STATUS.md with Aggressive mode..."
            create_status "Aggressive"
            ;;
        *)
            echo ""
            echo "[WARNING] Invalid choice. Defaulting to Hybrid mode..."
            create_status "Hybrid"
            ;;
    esac
    echo ""
fi

echo "[AGENTS-MD] Setup Complete. Agent Environment is ready for Passive Context."
