const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Sarvam AI Voice Agent...\n');

// Start backend
console.log('📡 Starting backend server...');
const backend = spawn('node', ['index.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Start frontend
console.log('🎨 Starting frontend...');
const frontend = spawn('npm', ['start'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, 'frontend'),
  shell: true
});

// Start agent
console.log('🤖 Starting LiveKit agent...');
const agent = spawn('node', ['agent.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  backend.kill();
  frontend.kill();
  agent.kill();
  process.exit();
});

backend.on('close', (code) => {
  console.log(`Backend exited with code ${code}`);
});

frontend.on('close', (code) => {
  console.log(`Frontend exited with code ${code}`);
});

agent.on('close', (code) => {
  console.log(`Agent exited with code ${code}`);
}); 