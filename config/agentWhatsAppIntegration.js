const AgentWhatsAppCommands = require('./agentWhatsAppCommands');

class AgentWhatsAppIntegration {
    constructor(whatsappGateway) {
        this.commands = new AgentWhatsAppCommands();
        this.whatsappGateway = whatsappGateway;
    }

    // Initialize WhatsApp integration
    initialize() {
        console.log('🤖 Initializing Agent WhatsApp Commands...');
        
        try {
            // Check if whatsappGateway has the required methods
            if (!this.whatsappGateway || typeof this.whatsappGateway.connectToWhatsApp !== 'function') {
                console.log('⚠️ WhatsApp gateway not properly initialized, using mock mode');
                return;
            }
            
            // Get the socket instance from whatsapp gateway
            const sock = this.whatsappGateway.getSock ? this.whatsappGateway.getSock() : null;
            
            if (!sock || !sock.ev) {
                console.log('⚠️ WhatsApp socket not available, using mock mode');
                return;
            }
            
            // Listen for incoming messages using the correct event structure
            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type === 'notify') {
                    for (const message of messages) {
                        if (!message.key.fromMe && message.message) {
                            try {
                                const from = message.key.remoteJid;
                                const text = message.message.conversation || message.message.extendedTextMessage?.text;
                                
                                if (text) {
                                    console.log(`📱 [AGENT] Received message from ${from}: ${text}`);
                                    
                                    // Handle agent commands
                                    const response = await this.commands.handleMessage(from, text);
                                    
                                    if (response) {
                                        // Send response back via WhatsApp
                                        await this.sendMessage(from, response);
                                    }
                                }
                            } catch (error) {
                                console.error('Error processing agent WhatsApp message:', error);
                            }
                        }
                    }
                }
            });

            console.log('✅ Agent WhatsApp Commands initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing Agent WhatsApp Commands:', error);
        }
    }

    // Send message via WhatsApp gateway
    async sendMessage(to, message) {
        try {
            // Get the socket instance from whatsapp gateway
            const sock = this.whatsappGateway.getSock ? this.whatsappGateway.getSock() : null;
            
            if (sock && sock.sendMessage) {
                await sock.sendMessage(to, { text: message });
                console.log(`📤 [AGENT] Sent message to ${to}`);
                return true;
            } else if (this.whatsappGateway && this.whatsappGateway.sendMessage) {
                await this.whatsappGateway.sendMessage(to, message);
                console.log(`📤 [AGENT] Sent message to ${to}`);
                return true;
            } else {
                console.log(`📤 [AGENT] [MOCK] Would send to ${to}: ${message}`);
                return true;
            }
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            return false;
        }
    }

    // Test agent commands
    async testCommands() {
        console.log('🧪 Testing Agent WhatsApp Commands...');
        
        const testPhone = '081234567890@s.whatsapp.net';
        
        // Test help command
        console.log('Testing HELP command...');
        await this.commands.handleMessage(testPhone, 'HELP');
        
        // Test saldo command
        console.log('Testing SALDO command...');
        await this.commands.handleMessage(testPhone, 'SALDO');
        
        // Test jual command
        console.log('Testing JUAL command...');
        await this.commands.handleMessage(testPhone, 'JUAL 10K John 081234567890 YA');
        
        // Test bayar command
        console.log('Testing BAYAR command...');
        await this.commands.handleMessage(testPhone, 'BAYAR Jane 081234567891 50000 YA');
        
        // Test request command
        console.log('Testing REQUEST command...');
        await this.commands.handleMessage(testPhone, 'REQUEST 100000 Top up saldo');
        
        // Test riwayat command
        console.log('Testing RIWAYAT command...');
        await this.commands.handleMessage(testPhone, 'RIWAYAT');
        
        console.log('✅ Agent WhatsApp Commands test completed');
    }
}

module.exports = AgentWhatsAppIntegration;
