#!/usr/bin/env node

/**
 * Script to test WhatsApp connection with proper version handling
 */

const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

async function testWhatsAppConnection() {
    try {
        console.log('🔍 Testing WhatsApp connection with latest version...');
        
        // Create session directory
        const sessionDir = './whatsapp-session-test';
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
            console.log(`📁 Session directory created: ${sessionDir}`);
        }
        
        // Get auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Fetch latest version
        const version = await fetchLatestBaileysVersion().catch(() => {
            console.warn('⚠️ Failed to fetch latest version, using default');
            return [2, 3000, 1027934701]; // Default fallback
        });
        
        console.log(`📱 Using WhatsApp Web version: ${Array.isArray(version) ? version.join('.') : 'Unknown'}`);
        
        // Create socket with latest version
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ['Test Connection', 'Chrome', '1.0.0'],
            version: version,
            printQRInTerminal: true,
            connectTimeoutMs: 30000
        });
        
        // Handle credentials update
        sock.ev.on('creds.update', saveCreds);
        
        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('📱 QR Code generated. Scan it with your WhatsApp app.');
            }
            
            if (connection === 'open') {
                console.log('✅ WhatsApp connected successfully!');
                console.log(`📱 Connected as: ${sock.user?.name || sock.user?.id}`);
                
                // Close connection after successful connection
                setTimeout(() => {
                    sock.end();
                    console.log('🔚 Connection test completed. Closing connection.');
                }, 5000);
            }
            
            if (connection === 'close') {
                console.log('🔚 WhatsApp connection closed.');
            }
        });
        
    } catch (error) {
        console.error('❌ Error during WhatsApp connection test:', error.message);
    }
}

// Run the test
testWhatsAppConnection();