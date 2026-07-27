# Paladium Redbubble Auto Uploader - CSV & Asset Validator (validator.py)
import os
import re
import pandas as pd
from pathlib import Path

REQUIRED_COLUMNS = ['image_filename', 'title']
OPTIONAL_COLUMNS = ['main_tag', 'supporting_tags', 'tags', 'description', 'background_color', 'hex']

HEX_COLOR_REGEX = re.compile(r'^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')

class CSVValidator:
    def __init__(self, csv_path: str, image_dir: str, filename_agnostic: bool = False):
        self.csv_path = Path(csv_path)
        self.image_dir = Path(image_dir)
        self.filename_agnostic = filename_agnostic
        self.errors = []
        self.warnings = []
        self.validated_data = []

    def validate(self):
        self.errors.clear()
        self.warnings.clear()
        self.validated_data.clear()

        if not self.csv_path.exists():
            self.errors.append(f"Metadata dataset file not found at path: {self.csv_path}")
            return self._get_result()

        if not self.image_dir.exists():
            self.errors.append(f"Image directory not found at path: {self.image_dir}")
            return self._get_result()

        # Handle JSON files natively
        if self.csv_path.suffix.lower() == '.json':
            try:
                import json
                with open(self.csv_path, 'r', encoding='utf-8') as f:
                    raw_data = json.load(f)
                    raw_items = raw_data if isinstance(raw_data, list) else [raw_data]
                    df = pd.DataFrame(raw_items)
            except Exception as e:
                self.errors.append(f"Failed to parse JSON file: {str(e)}")
                return self._get_result()
        else:
            try:
                df = pd.read_csv(self.csv_path)
            except Exception as e:
                self.errors.append(f"Failed to parse CSV file: {str(e)}")
                return self._get_result()

        if df.empty:
            self.errors.append("Dataset file is empty.")
            return self._get_result()

        # Clean column names
        df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]

        # Check required columns or fallbacks
        has_img_col = any(c in df.columns for c in ['image_filename', 'image', 'filename', 'file'])
        has_title_col = any(c in df.columns for c in ['title', 'design_title', 'name'])

        if not has_img_col:
            self.errors.append("Missing required column for image filename (expected 'image_filename').")
        if not has_title_col:
            self.errors.append("Missing required column for title (expected 'title').")

        if self.errors:
            return self._get_result()

        # Standardize column naming
        img_col = next(c for c in ['image_filename', 'image', 'filename', 'file'] if c in df.columns)
        title_col = next(c for c in ['title', 'design_title', 'name'] if c in df.columns)
        main_tag_col = next((c for c in ['main_tag', 'primary_tag', 'main_keyword'] if c in df.columns), None)
        supporting_tags_col = next((c for c in ['supporting_tags', 'secondary_tags', 'tags_secondary'] if c in df.columns), None)
        tags_col = next((c for c in ['tags', 'keywords'] if c in df.columns), None)
        desc_col = next((c for c in ['description', 'desc', 'product_description'] if c in df.columns), None)
        color_col = next((c for c in ['background_color', 'hex', 'bg_color', 'color'] if c in df.columns), None)

        for idx, row in df.iterrows():
            row_num = idx + 2 # 1-indexed header offset
            row_errors = []
            row_warnings = []

            img_name = str(row.get(img_col, '')).strip()
            title = str(row.get(title_col, '')).strip()

            if not img_name or img_name == 'nan':
                if self.filename_agnostic:
                    row_warnings.append(f"Row {row_num}: Missing image_filename (Filename Agnostic Mode active).")
                else:
                    row_errors.append(f"Row {row_num}: Missing image_filename.")
            else:
                img_path = self.image_dir / img_name
                if not img_path.exists():
                    if self.filename_agnostic:
                        available_pngs = list(self.image_dir.glob("*.png"))
                        if available_pngs:
                            row_warnings.append(f"Row {row_num}: '{img_name}' not found; using '{available_pngs[idx % len(available_pngs)].name}' (Agnostic Mode).")
                        else:
                            row_errors.append(f"Row {row_num}: No PNG image files found in directory.")
                    else:
                        row_errors.append(f"Row {row_num}: PNG image file '{img_name}' not found in directory.")

            if not title or title == 'nan':
                row_errors.append(f"Row {row_num}: Missing title.")

            # Direct Tag extraction from CSV / JSON
            main_tag = row.get(main_tag_col, '') if main_tag_col else ''
            if isinstance(main_tag, list): main_tag = main_tag[0] if main_tag else ''
            main_tag = str(main_tag).strip()

            supporting_tags = row.get(supporting_tags_col, '') if supporting_tags_col else ''
            if isinstance(supporting_tags, list): supporting_tags = ', '.join(map(str, supporting_tags))
            supporting_tags = str(supporting_tags).strip()

            combined_tags = row.get(tags_col, '') if tags_col else ''
            if isinstance(combined_tags, list): combined_tags = ', '.join(map(str, combined_tags))
            combined_tags = str(combined_tags).strip()

            if main_tag == 'nan': main_tag = ''
            if supporting_tags == 'nan': supporting_tags = ''
            if combined_tags == 'nan': combined_tags = ''

            if not main_tag and combined_tags:
                tag_list = [t.strip() for t in combined_tags.split(',') if t.strip()]
                if tag_list:
                    main_tag = tag_list[0]

            desc = str(row.get(desc_col, '')).strip() if desc_col else ''
            if desc == 'nan': desc = ''

            bg_color = str(row.get(color_col, '')).strip() if color_col else ''
            if bg_color == 'nan': bg_color = ''
            if bg_color and not bg_color.startswith('#'):
                bg_color = '#' + bg_color

            if bg_color and not HEX_COLOR_REGEX.match(bg_color):
                row_warnings.append(f"Row {row_num}: Invalid HEX color format '{bg_color}'.")

            self.errors.extend(row_errors)
            self.warnings.extend(row_warnings)

            self.validated_data.append({
                'row_index': idx,
                'row_num': row_num,
                'image_filename': img_name,
                'title': title,
                'main_tag': main_tag,
                'supporting_tags': supporting_tags,
                'description': desc,
                'background_color': bg_color,
                'is_valid': len(row_errors) == 0
            })

        return self._get_result()

    def _get_result(self):
        valid_rows = [r for r in self.validated_data if r['is_valid']]
        return {
            'is_valid': len(self.errors) == 0,
            'total_rows': len(self.validated_data),
            'valid_rows_count': len(valid_rows),
            'error_count': len(self.errors),
            'warning_count': len(self.warnings),
            'errors': self.errors,
            'warnings': self.warnings,
            'data': self.validated_data
        }

if __name__ == "__main__":
    from config import SAMPLE_DATA_DIR
    csv_file = SAMPLE_DATA_DIR / "matrix_panda_metadata.csv"
    img_dir = SAMPLE_DATA_DIR
    validator = CSVValidator(str(csv_file), str(img_dir))
    res = validator.validate()
    print(f"Validation Result: Valid={res['is_valid']} | Total={res['total_rows']} | Errors={res['error_count']}")
