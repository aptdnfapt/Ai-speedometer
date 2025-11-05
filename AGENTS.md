--
1. dont read ai-benchmark-config.json read the ai-benchmark-config.json.template
2. dont dare to check sensitive files containing keys 
3. always keep the docs and readme uptodate 
4. never run cat ~/.config/ai-speedometer/ai-benchmark-config.json 
5. custom-verified-providers.json is embedded in esbuild bundle during build time - this is intentional because these are custom verified providers that models.dev hasn't added yet. Changes to the JSON require rebuilding the executable to take effect. 
