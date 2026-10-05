## [{{ tag }}] - {{ date }}

{%- if breaking %}
### ⚠️ Breaking Changes
{% for c in commits if c.is_breaking -%}
- {{ c.line }}
{%- if c.breaking_description %}
  > ⚠️ **Migration**: {{ c.breaking_description }}
{%- endif %}
{% endfor %}
{%- endif %}

{%- for type, type_commits in commits | group_by_type %}
{%- if type == 'feat' %}
### 🚀 Features & Enhancements
{%- elif type == 'fix' %}
### 🐛 Bug Fixes
{%- elif type == 'perf' %}
### ⚡ Performance Improvements
{%- elif type == 'refactor' %}
### 🔄 Code Refactoring
{%- elif type == 'docs' %}
### 📚 Documentation
{%- elif type in ['chore', 'build', 'ci', 'test', 'style', 'revert'] %}
### 🛠️ Maintenance & Dependencies
{%- else %}
### 📦 {{ type | title }}
{%- endif %}
{% for c in type_commits if not c.is_breaking -%}
- {{ c.line }}
{% endfor %}
{%- endfor %}

{%- if contributors %}
### 👥 Contributors
{% for author in contributors -%}
- @{{ author }}
{% endfor %}
{%- endif %}

---
{%- if compare_url %}
**Full Changelog**: {{ compare_url }}
{%- endif %}
{%- if env("GITHUB_RUN_NUMBER") %} • *CI Build #{{ env("GITHUB_RUN_NUMBER") }}*{%- endif %}
