// Debug script to test mDNS discovery
import { Bonjour } from 'bonjour-service';
import os from 'os';

const bonjour = new Bonjour();

console.log('🔍 Starting mDNS debug...');
console.log('Device:', os.hostname());
console.log('Network interfaces:');

// Show network interfaces
const interfaces = os.networkInterfaces();
Object.keys(interfaces).forEach((name) => {
  const addrs = interfaces[name];
  addrs?.forEach((addr) => {
    if (addr.family === 'IPv4' && !addr.internal) {
      console.log(`  ${name}: ${addr.address}`);
    }
  });
});

// Publish service
console.log('\n📡 Publishing mDNS service...');
const service = bonjour.publish({
  name: os.hostname(),
  type: 'lanclip',
  port: 8765,
  txt: {
    deviceId: `debug-${Date.now()}`,
  },
});

console.log('Published:', service);

// Browse for services
console.log('\n🔎 Browsing for lanclip services...');
const browser = bonjour.find({ type: 'lanclip' });

browser.on('up', (service: any) => {
  console.log('\n✅ FOUND SERVICE:');
  console.log('  Name:', service.name);
  console.log('  Type:', service.type);
  console.log('  Port:', service.port);
  console.log('  Host:', service.host);
  console.log('  IP:', service.referer?.address);
  console.log('  TXT:', service.txt);
  console.log('  FQDN:', service.fqdn);
});

browser.on('down', (service: any) => {
  console.log('\n❌ SERVICE WENT DOWN:', service.name);
});

console.log('\n⏳ Listening for 30 seconds...\n');
console.log('Run this script on BOTH devices and see if they find each other!\n');

setTimeout(() => {
  console.log('\n⏹️  Stopping...');
  browser.stop();
  bonjour.unpublishAll();
  bonjour.destroy();
  process.exit(0);
}, 30000);
