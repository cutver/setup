**✨ What's Changed in {{ tag }}**
{% if breaking %}
### ⚠️ Breaking Changes
{{ breaking }}
{% endif -%}
{% if features %}
### 🚀 Features & Enhancements
{{ features }}
{% endif -%}
{% if fixes %}
### 🐛 Bug Fixes
{{ fixes }}
{% endif -%}
{% if perf %}
### ⚡ Performance Improvements
{{ perf }}
{% endif -%}
{% if refactor %}
### 🛠 Code Refactoring
{{ refactor }}
{% endif -%}
{% if docs %}
### 📚 Documentation
{{ docs }}
{% endif -%}
{% if maintenance %}
### 🧰 Maintenance & Dependencies
{{ maintenance }}
{% endif -%}
{% if other %}
### 🔍 Other Changes
{{ other }}
{% endif -%}
{% if contributors %}
### 👥 Contributors
{% for author in contributors -%}
- @{{ author }}
{% endfor -%}
{% endif -%}
{% if compare_url %}
---
**Full Diff**: {{ compare_url }}
{%- endif %}
