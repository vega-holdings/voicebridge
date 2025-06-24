#!/usr/bin/env node

require('dotenv').config();
const fetch = require('node-fetch');
const { program } = require('commander');

// CLI Configuration
program
  .name('call-senator')
  .description('Automated political advocacy calling system')
  .version('1.0.0');

program
  .command('call')
  .description('Make an automated call about an issue')
  .option('-i, --issue <issue>', 'Issue to discuss', 'general political concerns')
  .option('-n, --number <number>', 'Phone number to call')
  .option('-m, --mode <mode>', 'Call mode: live or precanned', 'live')
  .option('-s, --script <script>', 'Pre-written script for precanned mode')
  .option('--dry-run', 'Test without making actual call')
  .action(async (options) => {
    try {
      const config = {
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        targetNumber: options.number || process.env.TARGET_NUMBER,
        mode: options.mode,
        issue: options.issue,
        script: options.script
      };

      if (!config.targetNumber) {
        console.error('Error: Phone number required. Use --number or set TARGET_NUMBER env var');
        process.exit(1);
      }

      if (options.dryRun) {
        console.log('DRY RUN - Call details:');
        console.log(`Number: ${config.targetNumber}`);
        console.log(`Issue: ${config.issue}`);
        console.log(`Mode: ${config.mode}`);
        return;
      }

      console.log(`Initiating call to ${config.targetNumber}...`);
      console.log(`Issue: ${config.issue}`);
      console.log(`Mode: ${config.mode}`);

      const response = await fetch(`${config.baseUrl}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: config.targetNumber,
          issue: config.issue,
          mode: config.mode,
          script: config.script
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ Call initiated successfully`);
        console.log(`Call SID: ${result.callSid}`);
        console.log(`Status: ${result.status}`);
        
        // Monitor call status
        if (process.env.MONITOR_CALLS !== 'false') {
          monitorCall(config.baseUrl, result.callSid);
        }
      } else {
        console.error(`❌ Call failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check status of recent calls')
  .option('-l, --limit <limit>', 'Number of recent calls to show', '10')
  .action(async (options) => {
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/calls?limit=${options.limit}`);
      const calls = await response.json();
      
      console.log('\nRecent Calls:');
      console.log('─'.repeat(80));
      
      calls.forEach(call => {
        const duration = call.duration ? `${call.duration}s` : 'ongoing';
        const status = call.status.toUpperCase();
        console.log(`${call.call_sid} | ${status} | ${duration} | ${call.created_at}`);
      });
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  });

program
  .command('transcript')
  .description('Get transcript of a call')
  .argument('<call-sid>', 'Call SID to get transcript for')
  .action(async (callSid) => {
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/calls/${callSid}/transcript`);
      const transcript = await response.json();
      
      console.log(`\nTranscript for Call ${callSid}:`);
      console.log('─'.repeat(50));
      
      transcript.turns.forEach(turn => {
        const speaker = turn.speaker === 'user' ? '🗣️  CALLER' : '🤖 AI';
        console.log(`${speaker}: ${turn.content}`);
        console.log('');
      });
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  });

program
  .command('generate-script')
  .description('Generate a TTS audio file for precanned mode')
  .argument('<script>', 'Text script to convert to audio')
  .option('-o, --output <file>', 'Output file path', './generated_script.wav')
  .action(async (script, options) => {
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/generate-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: script,
          output: options.output
        })
      });
      
      if (response.ok) {
        console.log(`✅ Audio generated: ${options.output}`);
      } else {
        const error = await response.json();
        console.error(`❌ Generation failed: ${error.error}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  });

async function monitorCall(baseUrl, callSid) {
  console.log('\nMonitoring call status...');
  
  const checkStatus = async () => {
    try {
      const response = await fetch(`${baseUrl}/calls/${callSid}/status`);
      const status = await response.json();
      
      process.stdout.write(`\r📞 Status: ${status.status} | Duration: ${status.duration || 0}s`);
      
      if (status.status === 'completed' || status.status === 'failed') {
        console.log(`\n✅ Call ${status.status}`);
        if (status.transcript) {
          console.log('\nQuick transcript preview:');
          console.log(status.transcript.substring(0, 200) + '...');
        }
        return;
      }
      
      setTimeout(checkStatus, 2000); // Check every 2 seconds
    } catch (error) {
      console.log(`\n❌ Monitoring error: ${error.message}`);
    }
  };
  
  setTimeout(checkStatus, 1000); // Start monitoring after 1 second
}

// Senator contact database (example)
const senators = {
  'fcc-title-ii': {
    numbers: [
      '+12025224261', // Example senate office
    ],
    script: `Hello, I'm calling to express my support for strong FCC Title II net neutrality protections. 
    The internet should remain open and free from ISP interference. I urge the senator to support 
    legislation that maintains net neutrality principles. Thank you for your time.`
  },
  'climate-action': {
    numbers: ['+12025224261'],
    script: `Hi, I'm calling to urge support for ambitious climate action legislation. 
    The scientific consensus is clear that we need immediate action on climate change. 
    Please support policies that transition us to clean energy and reduce carbon emissions. 
    Thank you.`
  }
};

// Add preset command for common issues
program
  .command('preset')
  .description('Use preset script and numbers for common issues')
  .argument('<issue>', 'Preset issue key (fcc-title-ii, climate-action, etc.)')
  .option('--list', 'List available presets')
  .action(async (issue, options) => {
    if (options.list) {
      console.log('\nAvailable presets:');
      Object.keys(senators).forEach(key => {
        console.log(`- ${key}`);
      });
      return;
    }
    
    const preset = senators[issue];
    if (!preset) {
      console.error(`❌ Unknown preset: ${issue}`);
      console.log('Use --list to see available presets');
      return;
    }
    
    console.log(`Using preset: ${issue}`);
    console.log(`Script: ${preset.script.substring(0, 100)}...`);
    console.log(`Calling ${preset.numbers.length} number(s)...`);
    
    // Call each number in the preset
    for (const number of preset.numbers) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between calls
      
      try {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/calls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: number,
            issue: issue,
            mode: 'precanned',
            script: preset.script
          })
        });
        
        const result = await response.json();
        console.log(`📞 ${number}: ${result.status} (${result.callSid})`);
      } catch (error) {
        console.error(`❌ ${number}: ${error.message}`);
      }
    }
  });

program.parse();
