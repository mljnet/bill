const AgentManager = require('./agentManager');
const AgentWhatsAppManager = require('./agentWhatsApp');

class AgentWhatsAppCommands {
    constructor() {
        this.agentManager = new AgentManager();
        this.whatsappManager = new AgentWhatsAppManager();
    }

    // Handle incoming WhatsApp messages from agents
    async handleMessage(from, message) {
        try {
            const phone = from.replace('@s.whatsapp.net', '');
            
            // Check if this is an agent
            const agent = await this.agentManager.getAgentByPhone(phone);
            if (!agent) {
                return this.sendMessage(from, "❌ Anda belum terdaftar sebagai agent. Hubungi admin untuk pendaftaran.");
            }

            // Parse command
            const command = this.parseCommand(message);
            
            switch (command.type) {
                case 'help':
                    return this.handleHelp(from);
                case 'saldo':
                    return this.handleCheckBalance(from, agent);
                case 'jual':
                    return this.handleSellVoucher(from, agent, command.params);
                case 'bayar':
                    return this.handleProcessPayment(from, agent, command.params);
                case 'request':
                    return this.handleRequestBalance(from, agent, command.params);
                case 'riwayat':
                    return this.handleTransactionHistory(from, agent);
                default:
                    return this.sendMessage(from, "❌ Command tidak dikenali. Ketik *HELP* untuk melihat daftar command.");
            }
        } catch (error) {
            console.error('Error handling WhatsApp message:', error);
            return this.sendMessage(from, "❌ Terjadi kesalahan. Silakan coba lagi.");
        }
    }

    // Parse command from message
    parseCommand(message) {
        const text = message.toLowerCase().trim();
        
        if (text.includes('help') || text.includes('bantuan')) {
            return { type: 'help' };
        }
        
        if (text.includes('saldo') || text.includes('balance')) {
            return { type: 'saldo' };
        }
        
        if (text.includes('jual') || text.includes('sell')) {
            const params = this.parseSellParams(text);
            return { type: 'jual', params };
        }
        
        if (text.includes('bayar') || text.includes('payment')) {
            const params = this.parsePaymentParams(text);
            return { type: 'bayar', params };
        }
        
        if (text.includes('request') || text.includes('minta')) {
            const params = this.parseRequestParams(text);
            return { type: 'request', params };
        }
        
        if (text.includes('riwayat') || text.includes('history')) {
            return { type: 'riwayat' };
        }
        
        return { type: 'unknown' };
    }

    // Parse sell voucher parameters
    parseSellParams(text) {
        // Format Simple:
        // 1. "JUAL 3K" - Jual voucher tanpa kirim ke konsumen (hanya notif ke agent)
        // 2. "JUAL 3K 0852222222222" - Jual voucher dan kirim ke konsumen + notif ke agent
        
        const parts = text.split(' ');
        const jualIndex = parts.findIndex(p => p.includes('jual'));
        
        if (jualIndex === -1) {
            return null;
        }
        
        // Everything after 'jual' is package + optional phone number
        const remainingParts = parts.slice(jualIndex + 1);
        
        if (remainingParts.length === 0) {
            return null;
        }
        
        // Check if last part is a phone number
        const phonePattern = /^[0-9]+$/;
        const lastPart = remainingParts[remainingParts.length - 1];
        const hasPhoneNumber = phonePattern.test(lastPart);
        
        let packageParts, customerPhone;
        
        if (hasPhoneNumber) {
            // Format: JUAL [PAKET] [NOMOR_HP]
            customerPhone = lastPart;
            packageParts = remainingParts.slice(0, -1);
        } else {
            // Format: JUAL [PAKET]
            customerPhone = null;
            packageParts = remainingParts;
        }
        
        if (packageParts.length === 0) {
            return null;
        }
        
        // Find matching package
        const availablePackages = ['3k', '5k', '10k', '15k', '25k', '50k', 'member 7 hari', 'member 30 hari', 'member 90 hari'];
        
        let packageName = '';
        let bestMatch = '';
        let bestMatchLength = 0;
        
        // Find the best matching package (exact match first, then substring)
        for (const pkg of availablePackages) {
            const pkgParts = pkg.split(' ');
            if (packageParts.length >= pkgParts.length) {
                // Check if first parts match package name exactly
                const exactMatch = pkgParts.every((pkgPart, index) => 
                    packageParts[index] && packageParts[index].toLowerCase() === pkgPart.toLowerCase()
                );
                
                if (exactMatch && pkgParts.length > bestMatchLength) {
                    bestMatch = pkg;
                    bestMatchLength = pkgParts.length;
                }
            }
        }
        
        // If no exact match found, try substring match
        if (!bestMatch) {
            for (const pkg of availablePackages) {
                const pkgParts = pkg.split(' ');
                if (packageParts.length >= pkgParts.length) {
                    // Check if first parts contain package name (substring match)
                    const substringMatch = pkgParts.every((pkgPart, index) => 
                        packageParts[index] && packageParts[index].toLowerCase().includes(pkgPart.toLowerCase())
                    );
                    
                    if (substringMatch && pkgParts.length > bestMatchLength) {
                        bestMatch = pkg;
                        bestMatchLength = pkgParts.length;
                    }
                }
            }
        }
        
        if (bestMatch) {
            packageName = bestMatch;
        } else {
            // Fallback: use first part as package name
            packageName = packageParts[0];
        }
        
        return {
            package: packageName,
            customerName: '', // No customer name in simple format
            customerPhone: customerPhone,
            sendWhatsApp: hasPhoneNumber // Send to customer only if phone number provided
        };
    }

    // Parse payment parameters
    parsePaymentParams(text) {
        // Format: BAYAR [NAMA_PELANGGAN] [NOMOR_HP] [JUMLAH] [KIRIM_WHATSAPP]
        const parts = text.split(' ');
        const bayarIndex = parts.findIndex(p => p.includes('bayar'));
        
        if (bayarIndex === -1 || parts.length < bayarIndex + 4) {
            return null;
        }
        
        return {
            customerName: parts[bayarIndex + 1],
            customerPhone: parts[bayarIndex + 2],
            amount: parseFloat(parts[bayarIndex + 3]),
            sendWhatsApp: parts[bayarIndex + 4] === 'ya' || parts[bayarIndex + 4] === 'yes'
        };
    }

    // Parse request balance parameters
    parseRequestParams(text) {
        // Format: REQUEST [JUMLAH] [CATATAN]
        const parts = text.split(' ');
        const requestIndex = parts.findIndex(p => p.includes('request') || p.includes('minta'));
        
        if (requestIndex === -1 || parts.length < requestIndex + 2) {
            return null;
        }
        
        return {
            amount: parseFloat(parts[requestIndex + 1]),
            notes: parts.slice(requestIndex + 2).join(' ')
        };
    }

    // Handle help command
    async handleHelp(from) {
        const helpText = `🤖 *COMMAND AGENT WHATSAPP*

📋 *Daftar Command:*

🔍 *SALDO* - Cek saldo agent
📱 *JUAL [PAKET]* - Jual voucher (tanpa kirim ke konsumen)
📱 *JUAL [PAKET] [NOMOR_HP]* - Jual voucher + kirim ke konsumen
💰 *BAYAR [NAMA] [HP] [JUMLAH] [YA/TIDAK]* - Terima pembayaran
📤 *REQUEST [JUMLAH] [CATATAN]* - Request saldo ke admin
📊 *RIWAYAT* - Lihat riwayat transaksi

📝 *Contoh Penggunaan:*
• SALDO
• JUAL 3K
• JUAL 10K 081234567890
• JUAL Member 7 Hari 081234567891
• BAYAR Jane 081234567891 50000 YA
• REQUEST 100000 Top up saldo
• RIWAYAT

❓ Ketik *HELP* untuk melihat menu ini lagi.`;

        return this.sendMessage(from, helpText);
    }

    // Handle check balance
    async handleCheckBalance(from, agent) {
        try {
            const balance = await this.agentManager.getAgentBalance(agent.id);
            const message = `💰 *SALDO AGENT*

👤 Agent: ${agent.name}
📱 Phone: ${agent.phone}
💰 Saldo: Rp ${balance.toLocaleString('id-ID')}

📅 Terakhir update: ${new Date().toLocaleString('id-ID')}`;

            return this.sendMessage(from, message);
        } catch (error) {
            return this.sendMessage(from, "❌ Gagal mengambil data saldo.");
        }
    }

    // Handle sell voucher
    async handleSellVoucher(from, agent, params) {
        if (!params) {
            return this.sendMessage(from, "❌ Format salah. Gunakan: *JUAL [PAKET]* atau *JUAL [PAKET] [NOMOR_HP]*");
        }

        try {
            // Get available packages
            const packages = await this.agentManager.getAvailablePackages();
            const selectedPackage = packages.find(p => p.name.toLowerCase().includes(params.package.toLowerCase()));
            
            if (!selectedPackage) {
                return this.sendMessage(from, `❌ Paket tidak ditemukan. Paket tersedia: ${packages.map(p => p.name).join(', ')}`);
            }

            // Generate voucher code using package settings
            const voucherCode = this.agentManager.generateVoucherCode(selectedPackage);
            
            // Sell voucher
            const result = await this.agentManager.sellVoucher(
                agent.id,
                voucherCode,
                selectedPackage.id,
                params.customerName || 'Customer',
                params.customerPhone || ''
            );

            if (result.success) {
                let message = `🎉 *VOUCHER BERHASIL DIJUAL*

🎫 Kode Voucher: *${result.voucherCode}*
📦 Paket: ${result.packageName}
💰 Harga Jual: Rp ${result.customerPrice.toLocaleString('id-ID')}
💳 Harga Agent: Rp ${result.agentPrice.toLocaleString('id-ID')}
💵 Komisi: Rp ${result.commissionAmount.toLocaleString('id-ID')}

💰 Saldo tersisa: Rp ${result.newBalance.toLocaleString('id-ID')}`;

                // Send to customer if phone number provided
                if (params.sendWhatsApp && params.customerPhone) {
                    // Prepare agent info for customer message
                    const agentInfo = {
                        name: agent.name,
                        phone: agent.phone
                    };
                    
                    await this.whatsappManager.sendVoucherToCustomer(
                        params.customerPhone,
                        params.customerName || 'Customer',
                        result.voucherCode,
                        result.packageName,
                        result.customerPrice,
                        agentInfo
                    );
                    message += `\n\n📱 Notifikasi telah dikirim ke pelanggan (${params.customerPhone}).`;
                } else {
                    message += `\n\nℹ️ Voucher siap diberikan ke pelanggan secara langsung.`;
                }

                return this.sendMessage(from, message);
            } else {
                return this.sendMessage(from, `❌ Gagal menjual voucher: ${result.message}`);
            }
        } catch (error) {
            return this.sendMessage(from, "❌ Terjadi kesalahan saat menjual voucher.");
        }
    }

    // Handle process payment
    async handleProcessPayment(from, agent, params) {
        if (!params) {
            return this.sendMessage(from, "❌ Format salah. Gunakan: *BAYAR [NAMA] [HP] [JUMLAH] [YA/TIDAK]*");
        }

        try {
            // Process payment
            const result = await this.agentManager.processPayment(
                agent.id,
                params.customerName,
                params.customerPhone,
                params.amount
            );

            if (result.success) {
                let message = `✅ *PEMBAYARAN BERHASIL DIPROSES*

👤 Pelanggan: ${params.customerName}
📱 Phone: ${params.customerPhone}
💰 Jumlah: Rp ${params.amount.toLocaleString('id-ID')}
👤 Agent: ${agent.name}
📅 Tanggal: ${new Date().toLocaleString('id-ID')}

💰 Saldo agent: Rp ${result.newBalance.toLocaleString('id-ID')}`;

                // Send to customer if requested
                if (params.sendWhatsApp) {
                    await this.whatsappManager.sendPaymentConfirmation(
                        params.customerPhone,
                        params.customerName,
                        params.amount
                    );
                    message += `\n\n📱 Konfirmasi telah dikirim ke pelanggan.`;
                }

                return this.sendMessage(from, message);
            } else {
                return this.sendMessage(from, `❌ Gagal memproses pembayaran: ${result.message}`);
            }
        } catch (error) {
            return this.sendMessage(from, "❌ Terjadi kesalahan saat memproses pembayaran.");
        }
    }

    // Handle request balance
    async handleRequestBalance(from, agent, params) {
        if (!params) {
            return this.sendMessage(from, "❌ Format salah. Gunakan: *REQUEST [JUMLAH] [CATATAN]*");
        }

        try {
            const result = await this.agentManager.requestBalance(
                agent.id,
                params.amount,
                params.notes
            );

            if (result.success) {
                const message = `📤 *REQUEST SALDO BERHASIL*

💰 Jumlah: Rp ${params.amount.toLocaleString('id-ID')}
📝 Catatan: ${params.notes}
📅 Tanggal: ${new Date().toLocaleString('id-ID')}

⏳ Menunggu persetujuan admin...`;

                // Notify admin
                await this.whatsappManager.sendBalanceRequestToAdmin(
                    agent.name,
                    params.amount,
                    params.notes
                );

                return this.sendMessage(from, message);
            } else {
                return this.sendMessage(from, `❌ Gagal mengajukan request: ${result.message}`);
            }
        } catch (error) {
            return this.sendMessage(from, "❌ Terjadi kesalahan saat mengajukan request.");
        }
    }

    // Handle transaction history
    async handleTransactionHistory(from, agent) {
        try {
            const transactions = await this.agentManager.getAgentTransactions(agent.id, 10);
            
            let message = `📊 *RIWAYAT TRANSAKSI TERAKHIR*

👤 Agent: ${agent.name}
📅 Periode: 10 transaksi terakhir

`;

            if (transactions.length === 0) {
                message += "📝 Belum ada transaksi.";
            } else {
                transactions.forEach((tx, index) => {
                    const date = new Date(tx.created_at).toLocaleDateString('id-ID');
                    const time = new Date(tx.created_at).toLocaleTimeString('id-ID');
                    const amount = tx.amount.toLocaleString('id-ID');
                    
                    message += `${index + 1}. ${tx.transaction_type.toUpperCase()}\n`;
                    message += `   💰 Rp ${amount}\n`;
                    message += `   📅 ${date} ${time}\n`;
                    if (tx.description) {
                        message += `   📝 ${tx.description}\n`;
                    }
                    message += `\n`;
                });
            }

            return this.sendMessage(from, message);
        } catch (error) {
            return this.sendMessage(from, "❌ Gagal mengambil riwayat transaksi.");
        }
    }

    // Send message via WhatsApp
    async sendMessage(to, message) {
        try {
            // This would integrate with the existing WhatsApp gateway
            // For now, we'll just log the message
            console.log(`WhatsApp to ${to}: ${message}`);
            
            // TODO: Integrate with actual WhatsApp gateway
            return true;
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            return false;
        }
    }
}

module.exports = AgentWhatsAppCommands;
