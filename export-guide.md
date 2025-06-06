# Export Features Guide

This guide explains the various export mechanisms available for quiz results and leaderboard data.

## Available Export Endpoints

### 1. CSV Export for Quiz Answers
**Endpoint:** `GET /api/quiz-answers/csv`
- Returns quiz data in CSV format with proper headers
- Automatically downloads with timestamped filename (e.g., `quiz-answers-2024-01-15T10-30-00.csv`)
- Includes all participant info and quiz responses in flattened format
- Headers are Excel-friendly with simple column names

### 2. Excel XLSX Export for Quiz Answers  
**Endpoint:** `GET /api/quiz-answers/xlsx`
- Returns an actual Excel file (.xlsx format)
- Automatically downloads with timestamped filename (e.g., `quiz-answers-2024-01-15T10-30-00.xlsx`)
- Includes both participant info and quiz answers in properly formatted columns
- Uses the `xlsx` library for native Excel compatibility

### 3. Combined Export (Puzzle Scores + Quiz Answers)
**Endpoint:** `GET /api/export/combined`
- Exports both puzzle scores and quiz answers in one file
- Matches data by session_id to combine puzzle performance with quiz responses
- Supports both CSV and Excel formats via `format` parameter:
  - `?format=csv` - Returns CSV file
  - `?format=xlsx` - Returns Excel file (default)
- Filename format: `combined-export-2024-01-15T10-30-00.csv/xlsx`

### 4. Excel Web Query Files (.iqy)
These files allow Excel to import data directly from the API:

**Quiz Answers Web Query:** `GET /api/iqy/quiz-answers`
- Generates an `.iqy` file that Excel can open
- Points to the quiz answers export API endpoint
- When opened in Excel, automatically imports fresh data from the server

**Leaderboard Web Query:** `GET /api/iqy/leaderboard`
- Generates an `.iqy` file for leaderboard data
- Points to the leaderboard API with limit of 100 entries
- Updates can be refreshed in Excel to get latest data

## Usage Examples

### Direct Downloads
```
# Download CSV of quiz answers
https://your-domain.com/api/quiz-answers/csv

# Download Excel file of quiz answers
https://your-domain.com/api/quiz-answers/xlsx

# Download combined data as Excel
https://your-domain.com/api/export/combined

# Download combined data as CSV
https://your-domain.com/api/export/combined?format=csv
```

### Excel Web Queries
```
# Download .iqy file for quiz answers
https://your-domain.com/api/iqy/quiz-answers

# Download .iqy file for leaderboard
https://your-domain.com/api/iqy/leaderboard
```

## Data Format

All exports use the simplified field format:
- `question1_part1`, `question1_part2`, etc.
- `participant_name`, `participant_email`, `participant_mobile`
- `recipient1_name`, `recipient1_role`, etc.

## File Naming Convention

All generated files include timestamps to avoid conflicts:
- Format: `YYYY-MM-DDTHH-MM-SS` (e.g., `2024-01-15T10-30-00`)
- Example: `quiz-answers-2024-01-15T10-30-00.xlsx`

## Error Handling

All endpoints include proper error handling:
- Database availability checks
- Proper HTTP status codes
- Detailed error messages in JSON format
- Graceful handling of empty datasets

## Content Types

- CSV exports: `text/csv`
- Excel exports: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Web query files: `text/plain`
- All files include proper `Content-Disposition` headers for download