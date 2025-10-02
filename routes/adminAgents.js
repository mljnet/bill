const express = require('express');
const router = express.Router();
const AgentManager = require('../config/agentManager');
const { getSettingsWithCache } = require('../config/settingsManager');
const logger = require('../config/logger');
const { adminAuth } = require('./adminAuth');

// Initialize AgentManager
const agentManager = new AgentManager();

// ===== AGENT MANAGEMENT =====

// GET: Agents management page
router.get('/agents', adminAuth, async (req, res) => {
    try {
        res.render('admin/agents', {
            appSettings: getSettingsWithCache()
        });
    } catch (error) {
        logger.error('Admin agents page error:', error);
        res.status(500).send('Error loading agents page');
    }
});

// GET: Agent registrations page
router.get('/agent-registrations', adminAuth, async (req, res) => {
    try {
        res.render('admin/agent-registrations', {
            appSettings: getSettingsWithCache()
        });
    } catch (error) {
        logger.error('Admin agent registrations page error:', error);
        res.status(500).send('Error loading agent registrations page');
    }
});

// GET: Agent registrations API
router.get('/api/agent-registrations', adminAuth, async (req, res) => {
    try {
        const agents = await agentManager.getAllAgents();
        
        // Filter agents by status
        const pendingAgents = agents.filter(agent => agent.status === 'pending');
        const approvedAgents = agents.filter(agent => agent.status === 'active');
        const rejectedAgents = agents.filter(agent => agent.status === 'rejected');
        
        const stats = {
            pending: pendingAgents.length,
            approved: approvedAgents.length,
            rejected: rejectedAgents.length,
            total: agents.length
        };
        
        res.json({ 
            success: true, 
            agents: agents,
            stats: stats
        });
    } catch (error) {
        logger.error('Get agent registrations error:', error);
        res.json({ success: false, message: 'Error loading agent registrations' });
    }
});

// POST: Approve agent registration
router.post('/api/agent-registrations/:agentId/approve', adminAuth, async (req, res) => {
    try {
        const agentId = req.params.agentId;
        
        // Update agent status to active
        await agentManager.updateAgentStatus(agentId, 'active');
        
        // Create notification for agent
        await agentManager.createNotification(
            agentId,
            'registration_approved',
            'Pendaftaran Disetujui',
            'Pendaftaran Anda sebagai agent telah disetujui. Anda dapat login dan mulai transaksi.'
        );
        
        logger.info(`Agent ${agentId} registration approved by admin`);
        
        res.json({ success: true, message: 'Agent berhasil disetujui' });
    } catch (error) {
        logger.error('Approve agent registration error:', error);
        res.json({ success: false, message: 'Error approving agent registration' });
    }
});

// POST: Reject agent registration
router.post('/api/agent-registrations/:agentId/reject', adminAuth, async (req, res) => {
    try {
        const agentId = req.params.agentId;
        const { reason } = req.body;
        
        // Update agent status to rejected
        await agentManager.updateAgentStatus(agentId, 'rejected');
        
        // Create notification for agent
        await agentManager.createNotification(
            agentId,
            'registration_rejected',
            'Pendaftaran Ditolak',
            `Pendaftaran Anda sebagai agent ditolak.${reason ? ' Alasan: ' + reason : ''} Silakan daftar ulang dengan data yang benar.`
        );
        
        logger.info(`Agent ${agentId} registration rejected by admin. Reason: ${reason || 'No reason provided'}`);
        
        res.json({ success: true, message: 'Agent berhasil ditolak' });
    } catch (error) {
        logger.error('Reject agent registration error:', error);
        res.json({ success: false, message: 'Error rejecting agent registration' });
    }
});

// GET: List all agents
router.get('/agents/list', adminAuth, async (req, res) => {
    try {
        console.log('🔍 [DEBUG] Agents list route called');
        console.log('🔍 [DEBUG] Session:', req.session?.isAdmin ? 'Authenticated' : 'Not authenticated');
        const agents = await agentManager.getAllAgents();
        console.log('🔍 [DEBUG] Agents data:', agents?.length || 0, 'agents');
        res.json({ success: true, agents });
    } catch (error) {
        console.error('🔍 [DEBUG] Agents list error:', error);
        logger.error('Get agents list error:', error);
        res.json({ success: false, message: 'Error loading agents' });
    }
});

// GET: Get balance requests
router.get('/agents/balance-requests', adminAuth, async (req, res) => {
    try {
        console.log('🔍 [DEBUG] Balance requests route called');
        console.log('🔍 [DEBUG] Session:', req.session?.isAdmin ? 'Authenticated' : 'Not authenticated');
        const requests = await agentManager.getBalanceRequests();
        console.log('🔍 [DEBUG] Balance requests data:', requests?.length || 0, 'requests');
        res.json({ success: true, requests });
    } catch (error) {
        console.error('🔍 [DEBUG] Balance requests error:', error);
        logger.error('Get balance requests error:', error);
        res.json({ success: false, message: 'Error loading balance requests' });
    }
});

// GET: Agent detail page
router.get('/agents/:id', adminAuth, async (req, res) => {
    try {
        const agentId = parseInt(req.params.id);
        if (isNaN(agentId)) {
            return res.status(400).json({ success: false, message: 'Invalid agent ID' });
        }

        const agent = await agentManager.getAgentById(agentId);
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        res.render('admin/agent-detail', {
            agent,
            appSettings: getSettingsWithCache()
        });
    } catch (error) {
        logger.error('Agent detail page error:', error);
        res.status(500).json({ success: false, message: 'Error loading agent detail page' });
    }
});

// GET: Get agent details with statistics
router.get('/agents/:id/details', adminAuth, async (req, res) => {
    try {
        const agentId = parseInt(req.params.id);
        if (isNaN(agentId)) {
            return res.json({ success: false, message: 'Invalid agent ID' });
        }

        const agent = await agentManager.getAgentById(agentId);
        if (!agent) {
            return res.json({ success: false, message: 'Agent not found' });
        }

        // Get agent statistics
        const stats = await agentManager.getAgentStatistics(agentId);
        
        res.json({ 
            success: true, 
            agent,
            statistics: stats
        });
    } catch (error) {
        logger.error('Get agent details error:', error);
        res.json({ success: false, message: 'Error loading agent details' });
    }
});

// GET: Get agent transaction history
router.get('/agents/:id/transactions', adminAuth, async (req, res) => {
    try {
        const agentId = parseInt(req.params.id);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filter = req.query.filter || 'all';
        
        if (isNaN(agentId)) {
            return res.json({ success: false, message: 'Invalid agent ID' });
        }

        const transactions = await agentManager.getAgentTransactions(agentId, page, limit, filter);
        
        res.json({ 
            success: true, 
            transactions: transactions.data,
            pagination: transactions.pagination
        });
    } catch (error) {
        logger.error('Get agent transactions error:', error);
        res.json({ success: false, message: 'Error loading agent transactions' });
    }
});

// POST: Add new agent
router.post('/agents/add', adminAuth, async (req, res) => {
    try {
        const { username, name, phone, email, address, password, commission_rate } = req.body;
        
        if (!username || !name || !phone || !password) {
            return res.json({ success: false, message: 'Username, nama, nomor HP, dan password harus diisi' });
        }
        
        const agentData = {
            username,
            name,
            phone,
            email: email || null,
            address: address || null,
            password,
            commission_rate: parseFloat(commission_rate) || 5.00
        };
        
        const result = await agentManager.createAgent(agentData);
        
        if (result.success) {
            res.json({ success: true, message: 'Agent berhasil ditambahkan' });
        } else {
            res.json({ success: false, message: 'Gagal menambahkan agent' });
        }
    } catch (error) {
        logger.error('Add agent error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat menambahkan agent' });
    }
});


// PUT: Update agent
router.put('/agents/:id', adminAuth, async (req, res) => {
    try {
        const agentId = req.params.id;
        const { name, phone, email, address, commission_rate, status } = req.body;
        
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('./data/billing.db');
        
        const updateSql = `
            UPDATE agents 
            SET name = ?, phone = ?, email = ?, address = ?, commission_rate = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        db.run(updateSql, [name, phone, email, address, commission_rate, status, agentId], function(err) {
            db.close();
            
            if (err) {
                return res.json({ success: false, message: 'Gagal mengupdate agent' });
            }
            
            res.json({ success: true, message: 'Agent berhasil diupdate' });
        });
    } catch (error) {
        logger.error('Update agent error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat mengupdate agent' });
    }
});

// DELETE: Delete agent
router.delete('/agents/:id', adminAuth, async (req, res) => {
    try {
        const agentId = req.params.id;
        
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('./data/billing.db');
        
        // Start transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Delete in correct order to respect foreign key constraints
            const deleteQueries = [
                'DELETE FROM agent_voucher_sales WHERE agent_id = ?',
                'DELETE FROM agent_balances WHERE agent_id = ?',
                'DELETE FROM agent_notifications WHERE agent_id = ?',
                'DELETE FROM agent_transactions WHERE agent_id = ?',
                'DELETE FROM agent_monthly_payments WHERE agent_id = ?',
                'DELETE FROM agent_balance_requests WHERE agent_id = ?',
                'DELETE FROM agents WHERE id = ?'
            ];
            
            let completed = 0;
            let hasError = false;
            
            deleteQueries.forEach((query, index) => {
                db.run(query, [agentId], function(err) {
                    if (err) {
                        console.error(`Error deleting from query ${index + 1}:`, err.message);
                        hasError = true;
                    }
                    
                    completed++;
                    
                    // Check if all queries are completed
                    if (completed === deleteQueries.length) {
                        if (hasError) {
                            db.run('ROLLBACK');
                            db.close();
                            return res.json({ success: false, message: 'Gagal menghapus data agent terkait' });
                        } else {
                            db.run('COMMIT');
                            db.close();
                            res.json({ success: true, message: 'Agent dan semua data terkait berhasil dihapus' });
                        }
                    }
                });
            });
        });
    } catch (error) {
        logger.error('Delete agent error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat menghapus agent' });
    }
});

// ===== BALANCE REQUESTS =====

// POST: Approve balance request
router.post('/agents/approve-request', adminAuth, async (req, res) => {
    try {
        const { requestId, adminNotes } = req.body;
        const adminId = req.session.adminId || 1; // Use admin session ID or default
        
        const result = await agentManager.approveBalanceRequest(requestId, adminId, adminNotes);
        
        if (result.success) {
            // Send WhatsApp notification to agent
            try {
                const AgentWhatsAppManager = require('../config/agentWhatsApp');
                const whatsappManager = new AgentWhatsAppManager();
                
                // Get request details for notification
                const sqlite3 = require('sqlite3').verbose();
                const db = new sqlite3.Database('./data/billing.db');
                
                db.get(`
                    SELECT abr.*, a.name as agent_name, a.phone as agent_phone, ab.balance as current_balance
                    FROM agent_balance_requests abr
                    JOIN agents a ON abr.agent_id = a.id
                    LEFT JOIN agent_balances ab ON a.id = ab.agent_id
                    WHERE abr.id = ?
                `, [requestId], async (err, request) => {
                    db.close();
                    
                    if (!err && request) {
                        const agent = {
                            name: request.agent_name,
                            phone: request.agent_phone
                        };
                        
                        const requestData = {
                            amount: request.amount,
                            requestedAt: request.requested_at,
                            adminNotes: adminNotes,
                            previousBalance: request.current_balance - request.amount,
                            newBalance: request.current_balance
                        };
                        
                        await whatsappManager.sendRequestApprovedNotification(agent, requestData);
                    }
                });
            } catch (whatsappError) {
                logger.error('WhatsApp notification error:', whatsappError);
                // Don't fail the transaction if WhatsApp fails
            }
            
            res.json({ success: true, message: 'Request saldo berhasil disetujui' });
        } else {
            res.json({ success: false, message: 'Gagal menyetujui request saldo' });
        }
    } catch (error) {
        logger.error('Approve balance request error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat menyetujui request' });
    }
});

// POST: Reject balance request
router.post('/agents/reject-request', adminAuth, async (req, res) => {
    try {
        const { requestId, rejectReason } = req.body;
        
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('./data/billing.db');
        
        const updateSql = `
            UPDATE agent_balance_requests 
            SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, admin_notes = ?
            WHERE id = ?
        `;
        
        db.run(updateSql, [rejectReason, requestId], function(err) {
            if (err) {
                db.close();
                return res.json({ success: false, message: 'Gagal menolak request saldo' });
            }
            
            // Send WhatsApp notification to agent
            try {
                const AgentWhatsAppManager = require('../config/agentWhatsApp');
                const whatsappManager = new AgentWhatsAppManager();
                
                // Get request details for notification
                db.get(`
                    SELECT abr.*, a.name as agent_name, a.phone as agent_phone
                    FROM agent_balance_requests abr
                    JOIN agents a ON abr.agent_id = a.id
                    WHERE abr.id = ?
                `, [requestId], async (err, request) => {
                    db.close();
                    
                    if (!err && request) {
                        const agent = {
                            name: request.agent_name,
                            phone: request.agent_phone
                        };
                        
                        const requestData = {
                            amount: request.amount,
                            requestedAt: request.requested_at,
                            rejectReason: rejectReason
                        };
                        
                        await whatsappManager.sendRequestRejectedNotification(agent, requestData);
                    }
                });
            } catch (whatsappError) {
                logger.error('WhatsApp notification error:', whatsappError);
                // Don't fail the transaction if WhatsApp fails
            }
            
            res.json({ success: true, message: 'Request saldo berhasil ditolak' });
        });
    } catch (error) {
        logger.error('Reject balance request error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat menolak request' });
    }
});

// ===== AGENT STATISTICS =====

// GET: Get agent statistics
router.get('/agents/stats', adminAuth, async (req, res) => {
    try {
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('./data/billing.db');
        
        const stats = {};
        
        // Get total agents
        db.get('SELECT COUNT(*) as total FROM agents', (err, row) => {
            if (err) {
                db.close();
                return res.json({ success: false, message: 'Error getting agent count' });
            }
            
            stats.totalAgents = row.total;
            
            // Get active agents
            db.get('SELECT COUNT(*) as active FROM agents WHERE status = "active"', (err, row) => {
                if (err) {
                    db.close();
                    return res.json({ success: false, message: 'Error getting active agents' });
                }
                
                stats.activeAgents = row.active;
                
                // Get total balance requests
                db.get('SELECT COUNT(*) as total FROM agent_balance_requests', (err, row) => {
                    if (err) {
                        db.close();
                        return res.json({ success: false, message: 'Error getting balance requests' });
                    }
                    
                    stats.totalBalanceRequests = row.total;
                    
                    // Get pending balance requests
                    db.get('SELECT COUNT(*) as pending FROM agent_balance_requests WHERE status = "pending"', (err, row) => {
                        if (err) {
                            db.close();
                            return res.json({ success: false, message: 'Error getting pending requests' });
                        }
                        
                        stats.pendingBalanceRequests = row.pending;
                        
                        // Get total voucher sales
                        db.get('SELECT COUNT(*) as total FROM agent_voucher_sales', (err, row) => {
                            if (err) {
                                db.close();
                                return res.json({ success: false, message: 'Error getting voucher sales' });
                            }
                            
                            stats.totalVoucherSales = row.total;
                            
                            // Get total monthly payments
                            db.get('SELECT COUNT(*) as total FROM agent_monthly_payments', (err, row) => {
                                if (err) {
                                    db.close();
                                    return res.json({ success: false, message: 'Error getting monthly payments' });
                                }
                                
                                stats.totalMonthlyPayments = row.total;
                                
                                db.close();
                                res.json({ success: true, stats });
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        logger.error('Get agent stats error:', error);
        res.json({ success: false, message: 'Error loading agent statistics' });
    }
});

// ===== AGENT TRANSACTIONS =====

// GET: Get agent voucher sales
router.get('/agents/:id/vouchers', adminAuth, async (req, res) => {
    try {
        const agentId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const sales = await agentManager.getAgentVoucherSales(agentId, limit, offset);
        res.json({ success: true, sales });
    } catch (error) {
        logger.error('Get agent voucher sales error:', error);
        res.json({ success: false, message: 'Error loading agent voucher sales' });
    }
});

// GET: Get agent monthly payments
router.get('/agents/:id/payments', adminAuth, async (req, res) => {
    try {
        const agentId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const payments = await agentManager.getAgentMonthlyPayments(agentId, limit, offset);
        res.json({ success: true, payments });
    } catch (error) {
        logger.error('Get agent monthly payments error:', error);
        res.json({ success: false, message: 'Error loading agent monthly payments' });
    }
});

// ===== MANUAL BALANCE ADJUSTMENT =====

// POST: Manual balance adjustment
router.post('/agents/:id/adjust-balance', adminAuth, async (req, res) => {
    try {
        const agentId = req.params.id;
        const { amount, description } = req.body;
        
        if (!amount || !description) {
            return res.json({ success: false, message: 'Jumlah dan deskripsi harus diisi' });
        }
        
        const result = await agentManager.updateAgentBalance(
            agentId, 
            parseFloat(amount), 
            'deposit', 
            description
        );
        
        if (result.success) {
            res.json({ success: true, message: 'Saldo agent berhasil disesuaikan' });
        } else {
            res.json({ success: false, message: 'Gagal menyesuaikan saldo agent' });
        }
    } catch (error) {
        logger.error('Adjust agent balance error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat menyesuaikan saldo' });
    }
});

// POST: Toggle agent status
router.post('/agents/:id/toggle-status', adminAuth, async (req, res) => {
    try {
        const agentId = parseInt(req.params.id);
        const { status } = req.body;
        
        if (isNaN(agentId)) {
            return res.json({ success: false, message: 'Invalid agent ID' });
        }
        
        if (!['active', 'inactive', 'suspended'].includes(status)) {
            return res.json({ success: false, message: 'Invalid status' });
        }
        
        const result = await agentManager.updateAgentStatus(agentId, status);
        
        if (result.success) {
            res.json({ success: true, message: `Agent status berhasil diubah menjadi ${status}` });
        } else {
            res.json({ success: false, message: result.message });
        }
    } catch (error) {
        logger.error('Toggle agent status error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat mengubah status agent' });
    }
});

// POST: Update agent
router.post('/agents/update', adminAuth, async (req, res) => {
    try {
        const { id, username, name, phone, email, address, password, status } = req.body;
        
        if (!id || !username || !name || !phone) {
            return res.json({ success: false, message: 'Data yang diperlukan tidak lengkap' });
        }
        
        const result = await agentManager.updateAgent(id, {
            username,
            name,
            phone,
            email,
            address,
            password,
            status
        });
        
        if (result.success) {
            res.json({ success: true, message: 'Agent berhasil diupdate' });
        } else {
            res.json({ success: false, message: result.message });
        }
    } catch (error) {
        logger.error('Update agent error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat mengupdate agent' });
    }
});

// POST: Add balance to agent
router.post('/agents/add-balance', adminAuth, async (req, res) => {
    try {
        const { agentId, amount, notes } = req.body;
        
        if (!agentId || !amount) {
            return res.json({ success: false, message: 'Data yang diperlukan tidak lengkap' });
        }
        
        if (parseInt(amount) < 1000) {
            return res.json({ success: false, message: 'Jumlah saldo minimal Rp 1.000' });
        }
        
        const result = await agentManager.addBalance(agentId, parseInt(amount), notes || 'Saldo ditambahkan oleh admin');
        
        if (result.success) {
            res.json({ success: true, message: 'Saldo berhasil ditambahkan' });
        } else {
            res.json({ success: false, message: result.message });
        }
    } catch (error) {
        logger.error('Add balance error:', error);
        res.json({ success: false, message: 'Terjadi kesalahan saat menambahkan saldo' });
    }
});

module.exports = router;
