#!/bin/bash
# Script to apply NGS curriculum migrations to the database

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection parameters
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-noble_novacore}
DB_USER=${POSTGRES_USER:-noble}
DB_PASSWORD=${POSTGRES_PASSWORD:-novacoreAI2025}

echo "🚀 Applying NGS Curriculum Migrations"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found. Please install PostgreSQL client."
    exit 1
fi

# Function to run SQL file
run_migration() {
    local file=$1
    local description=$2
    
    echo "📄 Running: $description"
    echo "   File: $(basename $file)"
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$file" 2>&1 | grep -v "NOTICE"
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Success"
    else
        echo "   ❌ Failed"
        exit 1
    fi
    echo ""
}

# Get the project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
SCHEMA_DIR="$PROJECT_ROOT/shared/schemas"

# Check if schema files exist
if [ ! -f "$SCHEMA_DIR/03_ngs_lessons.sql" ]; then
    echo "❌ Error: Migration files not found in $SCHEMA_DIR"
    exit 1
fi

echo "Starting migrations..."
echo ""

# Run migrations in order
run_migration "$SCHEMA_DIR/03_ngs_lessons.sql" "Creating lesson management tables"
run_migration "$SCHEMA_DIR/04_ngs_curriculum_content.sql" "Populating 24 levels of curriculum content"
run_migration "$SCHEMA_DIR/05_ngs_update_levels.sql" "Updating curriculum level descriptions"

echo "✨ All migrations completed successfully!"
echo ""
echo "📊 Summary:"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
  (SELECT COUNT(*) FROM lessons) as lesson_count,
  (SELECT COUNT(*) FROM curriculum_levels) as level_count,
  (SELECT COUNT(DISTINCT level_id) FROM lessons) as levels_with_lessons;
" 2>/dev/null

echo ""
echo "🎓 NGS Curriculum is ready!"
