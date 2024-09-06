# @site-config

This directory contains configuration files for different sites and their associated chatbots.
Each site has its own set of configurations and prompts.

## Structure

- `config.json`: Main configuration file for all sites
- `prompts/`: Directory containing prompt templates and configurations for each site

## config.json

This file contains site-specific configurations for different chatbots. Each site has its own
object with various settings.

### Configuration Options

- `name`: The name of the chatbot
- `shortname`: A short name for the chatbot
- `tagline`: A brief description or slogan for the chatbot
- `greeting`: The initial greeting message from the chatbot
- `welcome_popup_heading`: Heading for the welcome popup
- `other_visitors_reference`: How to refer to other visitors
- `parent_site_url`: URL of the parent website
- `parent_site_name`: Name of the parent website
- `help_url`: URL for help documentation
- `help_text`: Text to display for the help link
- `collectionConfig`: Configuration for different document collections
- `libraryMappings`: Mappings for different library sources
- `enableSuggestedQueries`: Boolean to enable/disable suggested queries
- `enableMediaTypeSelection`: Boolean to enable/disable media type selection
- `enableAuthorSelection`: Boolean to enable/disable author selection
- `loginImage`: Image to display on the login screen

## Prompts

Each site has its own prompt configuration in the `prompts/` directory:

- `ananda.json`: Configuration for Ananda chatbot
- `jairam.json`: Configuration for Free Joe Hunt chatbot
- `crystal.json`: Configuration for Crystal Clarity chatbot

### Prompt Structure

Each prompt configuration consists of:

1. `variables`: Site-specific variables used in the prompts
2. `templates`: Templates for different parts of the prompt, including the base template

The base template for each site is stored in a separate text file (e.g., `ananda-base.txt`,
`jairam-base.txt`, `crystal-prompt.txt`).

## Usage

To add a new site or modify an existing one:

1. Add or modify the site configuration in `config.json`
2. Create or update the corresponding prompt configuration in `prompts/`
3. If needed, create a new base template file for the site's prompts

Ensure that all necessary fields are filled out in both the `config.json` and the prompt
configuration files.
