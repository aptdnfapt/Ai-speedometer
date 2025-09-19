#!/usr/bin/env node

import fs from 'fs';
import { spawn } from 'child_process';
import { testPrompt } from './test-prompt.js';

class LLMBenchmark {
  constructor(providerName, modelName) {
    this.providerName = providerName;
    this.modelName = modelName;
    this.config = this.loadConfig();
    this.validateProviderAndModel();
  }

  loadConfig() {
    const configPath = 'ai-benchmark-config.json';
    if (!fs.existsSync(configPath)) {
      throw new Error('Configuration file ai-benchmark-config.json not found');
    }
    
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  }

  validateProviderAndModel() {
    const providerConfig = this.config.providers.find(p => p.name === this.providerName);
    if (!providerConfig) {
      throw new Error(`Provider '${this.providerName}' not found in configuration`);
    }

    const modelConfig = providerConfig.models.find(m => m.name === this.modelName);
    if (!modelConfig) {
      throw new Error(`Model '${this.modelName}' not found for provider '${this.providerName}'`);
    }

    this.provider = providerConfig;
    this.model = modelConfig;
  }

  async runBenchmark() {
    console.log('=== LLM Benchmark ===');
    console.log(`Provider: ${this.providerName}`);
    console.log(`Model: ${this.modelName} (${this.model.name})`);
    console.log('Starting benchmark...');

    this.startTime = new Date();
    console.log(`Start time: ${this.startTime.toISOString()}`);

    const response = await this.makeApiCall();

    this.endTime = new Date();
    console.log(`End time: ${this.endTime.toISOString()}`);

    this.calculateAndDisplayMetrics(response);
  }

  async makeApiCall() {
    // Use correct endpoint based on provider type
    const endpoint = this.provider.type === 'anthropic' ? '/v1/messages' : '/chat/completions';
    const url = `${this.provider.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.provider.apiKey}`
    };

    // Add Anthropic-specific headers
    if (this.provider.type === 'anthropic') {
      headers['x-api-key'] = this.provider.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }

    const body = {
      model: this.model.name,
      messages: [
        { role: 'user', content: testPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7
    };

    // Adjust for Anthropic format
    if (this.provider.type === 'anthropic') {
      body.model = this.model.name;
      body.max_tokens = 1000;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  calculateAndDisplayMetrics(response) {
    const duration = (this.endTime - this.startTime) / 1000; // Convert to seconds

    let inputTokens, outputTokens;
    
    if (this.provider.type === 'anthropic') {
      inputTokens = response.usage?.input_tokens || this.estimateTokens(testPrompt);
      outputTokens = response.usage?.output_tokens || this.estimateTokens(response.content?.[0]?.text || '');
    } else {
      inputTokens = response.usage?.prompt_tokens || this.estimateTokens(testPrompt);
      outputTokens = response.usage?.completion_tokens || this.estimateTokens(response.choices?.[0]?.message?.content || '');
    }
    
    const totalTokens = inputTokens + outputTokens;
    const tokensPerSecond = duration > 0 ? totalTokens / duration : 0;

    console.log('\n=== Results ===');
    console.log(`Duration: ${duration.toFixed(3)} seconds`);
    console.log(`Input tokens: ${inputTokens}`);
    console.log(`Output tokens: ${outputTokens}`);
    console.log(`Total tokens: ${totalTokens}`);
    console.log(`Tokens per second: ${tokensPerSecond.toFixed(2)}`);
  }

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.round(text.length / 4);
  }

  async runBenchmarkForResults() {
    try {
      this.startTime = new Date();
      const response = await this.makeApiCall();
      this.endTime = new Date();

      const duration = (this.endTime - this.startTime) / 1000;
      
      let inputTokens, outputTokens;
      
      if (this.provider.type === 'anthropic') {
        inputTokens = response.usage?.input_tokens || this.estimateTokens(testPrompt);
        outputTokens = response.usage?.output_tokens || this.estimateTokens(response.content?.[0]?.text || '');
      } else {
        inputTokens = response.usage?.prompt_tokens || this.estimateTokens(testPrompt);
        outputTokens = response.usage?.completion_tokens || this.estimateTokens(response.choices?.[0]?.message?.content || '');
      }
      
      const totalTokens = inputTokens + outputTokens;
      const tokensPerSecond = duration > 0 ? totalTokens / duration : 0;

      return {
        provider: this.providerName,
        model: this.modelName,
        totalTokens: totalTokens,
        tokensPerSecond: Math.round(tokensPerSecond * 100) / 100,
        duration: Math.round(duration * 1000) / 1000,
        success: true
      };
    } catch (error) {
      return {
        provider: this.providerName,
        model: this.modelName,
        totalTokens: 0,
        tokensPerSecond: 0,
        duration: 0,
        success: false,
        error: error.message
      };
    }
  }
}

class ParallelBenchmark {
  constructor(config) {
    this.config = config;
  }

  async runAll() {
    console.log('=== LLM Benchmark ===');
    console.log('Running benchmarks on all configured models...');
    console.log(`Starting at ${new Date().toISOString()}`);
    console.log('');

    const benchmarks = this.createBenchmarks();
    const results = await this.runParallel(benchmarks);

    this.displayResultsTable(results);
    this.displaySummary(results);
  }

  async runSilent() {
    const benchmarks = this.createBenchmarks();
    return await this.runParallel(benchmarks);
  }

  createBenchmarks() {
    const benchmarks = [];

    this.config.providers.forEach(provider => {
      provider.models.forEach(model => {
        benchmarks.push(new LLMBenchmark(provider.name, model.name));
      });
    });

    return benchmarks;
  }

  async runParallel(benchmarks) {
    const results = [];
    
    // Run benchmarks in parallel using Promise.all
    const promises = benchmarks.map(benchmark => benchmark.runBenchmarkForResults());
    const benchmarkResults = await Promise.all(promises);
    
    results.push(...benchmarkResults);
    return results;
  }

  displayResultsTable(results) {
    // Sort results by tokens per second (descending)
    const sortedResults = results.sort((a, b) => b.tokensPerSecond - a.tokensPerSecond);

    // Calculate column widths
    const providerWidth = Math.max(...sortedResults.map(r => r.provider.length), 'Provider'.length);
    const modelWidth = Math.max(...sortedResults.map(r => r.model.length), 'Model'.length);
    const tokensWidth = 12;
    const tpsWidth = 15;

    // Table header
    const header = `| ${'Provider'.padEnd(providerWidth)} | ${'Model'.padEnd(modelWidth)} | ${'Total Tokens'.padStart(tokensWidth)} | ${'Tokens/sec'.padStart(tpsWidth)} |`;
    const separator = `| ${'-'.repeat(providerWidth)} | ${'-'.repeat(modelWidth)} | ${'-'.repeat(tokensWidth)} | ${'-'.repeat(tpsWidth)} |`;

    console.log(header);
    console.log(separator);

    // Table rows
    sortedResults.forEach(result => {
      if (result.success) {
        const providerCol = result.provider.padEnd(providerWidth);
        const modelCol = result.model.padEnd(modelWidth);
        const tokensCol = result.totalTokens.toString().padStart(tokensWidth);
        const tpsCol = result.tokensPerSecond.toString().padStart(tpsWidth);
        console.log(`| ${providerCol} | ${modelCol} | ${tokensCol} | ${tpsCol} |`);
      } else {
        const providerCol = result.provider.padEnd(providerWidth);
        const modelCol = result.model.padEnd(modelWidth);
        const tokensCol = 'ERROR'.padStart(tokensWidth);
        const tpsCol = 'FAILED'.padStart(tpsWidth);
        console.log(`| ${providerCol} | ${modelCol} | ${tokensCol} | ${tpsCol} |`);
      }
    });

    console.log('');
  }

  displaySummary(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('=== Summary ===');
    console.log(`Total benchmarks: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);

    if (successful.length > 0) {
      const avgTps = successful.reduce((sum, r) => sum + r.tokensPerSecond, 0) / successful.length;
      const fastest = successful.reduce((max, r) => r.tokensPerSecond > max.tokensPerSecond ? r : max);
      const slowest = successful.reduce((min, r) => r.tokensPerSecond < min.tokensPerSecond ? r : min);

      console.log(`Average tokens/sec: ${avgTps.toFixed(2)}`);
      console.log(`Fastest: ${fastest.provider}/${fastest.model} (${fastest.tokensPerSecond} tokens/sec)`);
      console.log(`Slowest: ${slowest.provider}/${slowest.model} (${slowest.tokensPerSecond} tokens/sec)`);
    }

    if (failed.length > 0) {
      console.log('\nFailed benchmarks:');
      failed.forEach(result => {
        console.log(`  ${result.provider}/${result.model}: ${result.error}`);
      });
    }
  }
}

class Tracker {
  constructor(config) {
    this.config = config;
    this.csvFile = `llm_benchmark_results_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.csv`;
    this.running = true;
    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    process.on('SIGINT', () => {
      this.running = false;
      console.log('\nStopping tracking...');
    });
    
    process.on('SIGTERM', () => {
      this.running = false;
      console.log('\nStopping tracking...');
    });
  }

  async startTracking() {
    console.log('=== LLM Performance Tracker ===');
    console.log('Tracking all models every 60 seconds');
    console.log(`Results will be saved to: ${this.csvFile}`);
    console.log('Press Ctrl+C to stop tracking');
    console.log('');
    
    // Initialize CSV file with header
    this.initializeCsv();
    
    // Run first benchmark immediately
    await this.runTrackingCycle();
    
    // Start continuous tracking loop
    while (this.running) {
      await this.sleep(60000); // Wait 1 minute between runs
      if (!this.running) break;
      await this.runTrackingCycle();
    }
    
    console.log('\nTracking stopped by user');
    console.log(`Results saved to: ${this.csvFile}`);
  }

  initializeCsv() {
    const header = 'timestamp,provider_model,tokens_per_second,total_tokens,duration_seconds\n';
    fs.writeFileSync(this.csvFile, header);
  }

  async runTrackingCycle() {
    const timestamp = new Date();
    console.log(`[${timestamp.toISOString()}] Running benchmark cycle...`);
    
    const parallelBenchmark = new ParallelBenchmark(this.config);
    const results = await parallelBenchmark.runSilent();
    
    this.writeResultsToCsv(timestamp, results);
    this.displayCycleSummary(results);
  }

  writeResultsToCsv(timestamp, results) {
    const csvLines = results
      .filter(result => result.success)
      .map(result => {
        const providerModel = `${result.provider}+${result.model}`;
        return [
          timestamp.toISOString(),
          providerModel,
          result.tokensPerSecond,
          result.totalTokens,
          result.duration
        ].join(',');
      })
      .join('\n');

    if (csvLines) {
      fs.appendFileSync(this.csvFile, csvLines + '\n');
    }
  }

  displayCycleSummary(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`  Completed: ${successful.length} successful, ${failed.length} failed`);
    
    if (successful.length > 0) {
      const avgTps = successful.reduce((sum, r) => sum + r.tokensPerSecond, 0) / successful.length;
      console.log(`  Average tokens/sec: ${avgTps.toFixed(2)}`);
    }
    
    if (failed.length > 0) {
      const failedNames = failed.map(f => `${f.provider}/${f.model}`).join(', ');
      console.log(`  Failed: ${failedNames}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--provider':
        options.provider = args[++i];
        break;
      case '--model':
        options.model = args[++i];
        break;
      case '--all':
        options.all = true;
        break;
      case '--track':
        options.track = true;
        break;
      case '--help':
        displayHelp();
        process.exit(0);
        break;
    }
  }

  if (options.track && !options.all) {
    console.log('Error: --track requires --all');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  if (options.all) {
    return options;
  } else if (options.provider && options.model) {
    return options;
  } else {
    console.log('Error: Either --provider and --model, or --all is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }
}

function displayHelp() {
  console.log('Usage: node benchmark-rest.js --provider PROVIDER --model MODEL');
  console.log('       node benchmark-rest.js --all [--track]');
  console.log('');
  console.log('Options:');
  console.log('  --provider PROVIDER  Provider name from ai-benchmark-config.json');
  console.log('  --model MODEL       Model name from ai-benchmark-config.json');
  console.log('  --all               Run benchmark on all configured models');
  console.log('  --track             Enable continuous tracking with CSV output (requires --all)');
  console.log('  --help              Display this help message');
}

async function main() {
  try {
    const options = parseArguments();

    if (options.all) {
      const config = JSON.parse(fs.readFileSync('ai-benchmark-config.json', 'utf8'));
      
      if (options.track) {
        const tracker = new Tracker(config);
        await tracker.startTracking();
      } else {
        const parallelBenchmark = new ParallelBenchmark(config);
        await parallelBenchmark.runAll();
      }
    } else {
      const benchmark = new LLMBenchmark(options.provider, options.model);
      await benchmark.runBenchmark();
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Handle process interruption
process.on('SIGINT', () => {
  console.log('\nBenchmark interrupted by user');
  process.exit(0);
});

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { LLMBenchmark, ParallelBenchmark, Tracker };