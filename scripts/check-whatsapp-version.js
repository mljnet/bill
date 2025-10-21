#!/usr/bin/env node

/**
 * Script to check the current WhatsApp Web version
 */

const { fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

async function checkWhatsAppVersion() {
    try {
        console.log('🔍 Checking latest WhatsApp Web version...');
        
        const versionResult = await fetchLatestBaileysVersion();
        let version;
        
        // Tangani berbagai tipe return value
        if (Array.isArray(versionResult)) {
            version = versionResult;
        } else if (versionResult && Array.isArray(versionResult.version)) {
            version = versionResult.version;
        } else if (versionResult && typeof versionResult === 'object') {
            // Jika merupakan objek, coba cari properti version
            version = versionResult.version || [2, 3000, 1023223821];
        } else {
            // Fallback
            version = [2, 3000, 1023223821];
        }
        
        console.log(`📱 Latest WhatsApp Web version: ${Array.isArray(version) ? version.join('.') : JSON.stringify(version)}`);
        
        // Also check the default version from Baileys
        const defaultVersion = require('../node_modules/@whiskeysockets/baileys/lib/Defaults/baileys-version.json');
        console.log(`📦 Default Baileys version: ${defaultVersion.version.join('.')}`);
        
        console.log('\n✅ Version check completed successfully');
    } catch (error) {
        console.error('❌ Error checking WhatsApp version:', error.message);
        
        // Fallback to default version
        const defaultVersion = require('../node_modules/@whiskeysockets/baileys/lib/Defaults/baileys-version.json');
        console.log(`🔄 Using fallback version: ${defaultVersion.version.join('.')}`);
    }
}

// Run the function
checkWhatsAppVersion();