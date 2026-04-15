/**
 * 心愿智库学习平台 - 核心JavaScript功能
 * 版本：v1.0.0
 * 创建日期：2026-04-15
 * 功能描述：平台核心交互、支付处理、用户管理逻辑
 */

(function() {
    'use strict';
    
    // ========================================
    // 全局配置
    // ========================================
    const CONFIG = {
        platform: {
            name: '心愿智库学习平台',
            version: '1.0.0',
            baseUrl: window.location.origin || 'https://xinyuanzhiku.com',
            apiBase: '/api/',
            debug: true
        },
        payment: {
            methods: ['wechat', 'alipay'],
            defaultMethod: 'wechat',
            amounts: {
                monthly: 29,
                yearly: 99,
                premium: 99
            },
            qrCodeSize: 250,
            timeout: 300000 // 5分钟超时
        },
        user: {
            defaultAvatar: '👨‍🔧',
            sessionExpire: 7 * 24 * 60 * 60 * 1000, // 7天
            localStorageKey: 'xinyuan_user_data'
        },
        content: {
            freeItems: 2,
            itemsPerPage: 10,
            cacheTime: 5 * 60 * 1000 // 5分钟缓存
        }
    };
    
    // ========================================
    // 工具函数
    // ========================================
    const Utils = {
        /**
         * 延迟执行
         * @param {number} ms - 延迟毫秒数
         * @returns {Promise} Promise对象
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        
        /**
         * 生成唯一ID
         * @returns {string} 唯一ID
         */
        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        },
        
        /**
         * 格式化金额
         * @param {number} amount - 金额（元）
         * @returns {string} 格式化后的金额
         */
        formatMoney(amount) {
            return `¥${amount.toFixed(2)}`;
        },
        
        /**
         * 格式化日期
         * @param {Date|string|number} date - 日期
         * @returns {string} 格式化后的日期
         */
        formatDate(date) {
            const d = new Date(date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        },
        
        /**
         * 获取URL参数
         * @param {string} name - 参数名
         * @returns {string|null} 参数值
         */
        getUrlParam(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        },
        
        /**
         * 验证邮箱格式
         * @param {string} email - 邮箱地址
         * @returns {boolean} 是否有效
         */
        validateEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },
        
        /**
         * 验证手机号格式
         * @param {string} phone - 手机号
         * @returns {boolean} 是否有效
         */
        validatePhone(phone) {
            const re = /^1[3-9]\d{9}$/;
            return re.test(phone);
        },
        
        /**
         * 显示消息提示
         * @param {string} message - 消息内容
         * @param {string} type - 类型: success, error, warning, info
         * @param {number} duration - 显示时间（毫秒）
         */
        showMessage(message, type = 'info', duration = 3000) {
            // 移除已有消息
            const existing = document.querySelector('.message-toast');
            if (existing) existing.remove();
            
            // 创建消息元素
            const toast = document.createElement('div');
            toast.className = `message-toast message-${type}`;
            toast.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: ${this.getMessageColor(type)};
                    color: white;
                    padding: 12px 20px;
                    border-radius: 4px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 9999;
                    max-width: 350px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: slideIn 0.3s ease;
                ">
                    <i class="fas ${this.getMessageIcon(type)}"></i>
                    <span>${message}</span>
                </div>
            `;
            
            document.body.appendChild(toast);
            
            // 自动移除
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        },
        
        /**
         * 获取消息类型的图标
         * @private
         */
        getMessageIcon(type) {
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-times-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            return icons[type] || 'fa-info-circle';
        },
        
        /**
         * 获取消息类型的颜色
         * @private
         */
        getMessageColor(type) {
            const colors = {
                success: '#27AE60',
                error: '#E74C3C',
                warning: '#F39C12',
                info: '#3498DB'
            };
            return colors[type] || '#3498DB';
        }
    };
    
    // 动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // ========================================
    // 用户管理系统
    // ========================================
    const UserManager = {
        /**
         * 获取当前用户
         * @returns {object|null} 用户信息
         */
        getCurrentUser() {
            const data = localStorage.getItem(CONFIG.user.localStorageKey);
            if (!data) return null;
            
            try {
                const userData = JSON.parse(data);
                
                // 检查会话是否过期
                if (userData.sessionExpire && Date.now() > userData.sessionExpire) {
                    this.logout();
                    return null;
                }
                
                return userData;
            } catch (error) {
                console.error('读取用户数据失败:', error);
                return null;
            }
        },
        
        /**
         * 设置当前用户
         * @param {object} userData - 用户数据
         */
        setCurrentUser(userData) {
            const fullData = {
                ...userData,
                lastLogin: Date.now(),
                sessionExpire: Date.now() + CONFIG.user.sessionExpire
            };
            
            localStorage.setItem(CONFIG.user.localStorageKey, JSON.stringify(fullData));
            
            // 触发用户状态变更事件
            window.dispatchEvent(new CustomEvent('userChange', { detail: fullData }));
        },
        
        /**
         * 用户登录
         * @param {string} username - 用户名
         * @param {string} password - 密码
         * @returns {Promise<object>} 登录结果
         */
        async login(username, password) {
            // 模拟API请求
            await Utils.sleep(500);
            
            // 简单的验证逻辑（实际应用中应该是服务器验证）
            if (!username || !password) {
                throw new Error('用户名和密码不能为空');
            }
            
            const userData = {
                id: Utils.generateId(),
                username: username,
                displayName: username,
                email: `${username}@xinyuan.com`,
                avatar: CONFIG.user.defaultAvatar,
                isLoggedIn: true,
                createdAt: Date.now(),
                subscriptions: [],
                freeContentAccessed: 0
            };
            
            this.setCurrentUser(userData);
            
            return {
                success: true,
                message: '登录成功',
                user: userData
            };
        },
        
        /**
         * 用户注册
         * @param {object} userInfo - 用户信息
         * @returns {Promise<object>} 注册结果
         */
        async register(userInfo) {
            // 模拟API请求
            await Utils.sleep(500);
            
            const { username, email, password, confirmPassword } = userInfo;
            
            // 验证
            if (!username || !email || !password) {
                throw new Error('请填写完整信息');
            }
            
            if (password !== confirmPassword) {
                throw new Error('两次输入的密码不一致');
            }
            
            if (!Utils.validateEmail(email)) {
                throw new Error('邮箱格式不正确');
            }
            
            // 检查用户名是否已存在（本地模拟）
            const existingUsers = JSON.parse(localStorage.getItem('xinyuan_users') || '[]');
            if (existingUsers.some(u => u.username === username)) {
                throw new Error('用户名已存在');
            }
            
            // 创建新用户
            const newUser = {
                id: Utils.generateId(),
                username: username,
                email: email,
                displayName: username,
                avatar: CONFIG.user.defaultAvatar,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                status: 'active'
            };
            
            // 保存用户（实际应用中应该是服务器保存）
            existingUsers.push(newUser);
            localStorage.setItem('xinyuan_users', JSON.stringify(existingUsers));
            
            // 自动登录
            const loginResult = await this.login(username, password);
            
            return {
                success: true,
                message: '注册成功',
                user: loginResult.user
            };
        },
        
        /**
         * 用户登出
         */
        logout() {
            localStorage.removeItem(CONFIG.user.localStorageKey);
            window.dispatchEvent(new CustomEvent('userChange', { detail: null }));
            
            Utils.showMessage('已退出登录', 'success');
        },
        
        /**
         * 检查用户订阅状态
         * @param {string} columnId - 专栏ID
         * @returns {boolean} 是否有有效订阅
         */
        hasValidSubscription(columnId = 'civil-engineering') {
            const user = this.getCurrentUser();
            if (!user || !user.subscriptions) return false;
            
            const subscription = user.subscriptions.find(sub => 
                sub.columnId === columnId && 
                sub.status === 'active' &&
                (!sub.expireAt || new Date(sub.expireAt) > new Date())
            );
            
            return !!subscription;
        },
        
        /**
         * 更新用户订阅
         * @param {string} columnId - 专栏ID
         * @param {string} planType - 计划类型
         * @param {object} orderInfo - 订单信息
         */
        updateSubscription(columnId, planType, orderInfo) {
            const user = this.getCurrentUser();
            if (!user) return false;
            
            // 计算过期时间
            const now = new Date();
            let expireAt = new Date(now);
            
            if (planType === 'monthly') {
                expireAt.setMonth(now.getMonth() + 1);
            } else if (planType === 'yearly') {
                expireAt.setFullYear(now.getFullYear() + 1);
            }
            
            // 创建订阅记录
            const subscription = {
                columnId: columnId,
                planType: planType,
                orderId: orderInfo.orderId,
                amount: orderInfo.amount,
                createdAt: now.toISOString(),
                expireAt: expireAt.toISOString(),
                status: 'active',
                paymentMethod: orderInfo.paymentMethod
            };
            
            // 更新用户订阅
            user.subscriptions = user.subscriptions || [];
            user.subscriptions.push(subscription);
            
            // 设置订阅到期提醒（可选）
            this.setSubscriptionReminder(expireAt);
            
            this.setCurrentUser(user);
            
            return true;
        },
        
        /**
         * 设置订阅到期提醒
         * @private
         */
        setSubscriptionReminder(expireDate) {
            // 提前3天提醒
            const reminderDate = new Date(expireDate);
            reminderDate.setDate(reminderDate.getDate() - 3);
            
            // 存储提醒时间（实际应用中可以使用浏览器通知）
            const reminders = JSON.parse(localStorage.getItem('subscription_reminders') || '[]');
            reminders.push({
                expireDate: expireDate.toISOString(),
                reminderDate: reminderDate.toISOString(),
                notified: false
            });
            
            localStorage.setItem('subscription_reminders', JSON.stringify(reminders));
        }
    };
    
    // ========================================
    // 支付管理系统
    // ========================================
    const PaymentManager = {
        /**
         * 创建订单
         * @param {string} planType - 计划类型
         * @param {string} paymentMethod - 支付方式
         * @returns {Promise<object>} 订单信息
         */
        async createOrder(planType, paymentMethod = CONFIG.payment.defaultMethod) {
            if (!CONFIG.payment.methods.includes(paymentMethod)) {
                throw new Error('不支持的支付方式');
            }
            
            const amount = CONFIG.payment.amounts[planType];
            if (!amount) {
                throw new Error('无效的计划类型');
            }
            
            // 生成订单信息
            const orderInfo = {
                orderId: `XY${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                planType: planType,
                amount: amount,
                paymentMethod: paymentMethod,
                createdAt: new Date().toISOString(),
                status: 'pending',
                userId: UserManager.getCurrentUser()?.id || 'guest'
            };
            
            // 存储订单（模拟）
            this.saveOrder(orderInfo);
            
            // 生成支付凭证
            const paymentInfo = await this.generatePayment(paymentMethod, amount, orderInfo.orderId);
            
            return {
                ...orderInfo,
                paymentInfo: paymentInfo
            };
        },
        
        /**
         * 生成支付凭证
         * @private
         */
        async generatePayment(method, amount, orderId) {
            await Utils.sleep(300);
            
            if (method === 'wechat') {
                return {
                    type: 'qrcode',
                    data: `weixin://wxpay/bizpayurl?pr=${orderId}`,
                    amount: amount,
                    instructions: '请使用微信扫一扫支付',
                    timeout: CONFIG.payment.timeout
                };
            } else if (method === 'alipay') {
                return {
                    type: 'qrcode',
                    data: `https://qr.alipay.com/${orderId}`,
                    amount: amount,
                    instructions: '请使用支付宝扫一扫支付',
                    timeout: CONFIG.payment.timeout
                };
            }
            
            return null;
        },
        
        /**
         * 模拟支付成功
         * @param {string} orderId - 订单ID
         * @returns {Promise<object>} 支付结果
         */
        async simulatePayment(orderId) {
            await Utils.sleep(1000);
            
            const orders = JSON.parse(localStorage.getItem('payment_orders') || '[]');
            const order = orders.find(o => o.orderId === orderId);
            
            if (!order) {
                throw new Error('订单不存在');
            }
            
            if (order.status === 'paid') {
                throw new Error('订单已支付');
            }
            
            // 更新订单状态
            order.status = 'paid';
            order.paidAt = new Date().toISOString();
            
            this.saveOrder(order);
            
            // 更新用户订阅
            const user = UserManager.getCurrentUser();
            if (user) {
                UserManager.updateSubscription('civil-engineering', order.planType, order);
            }
            
            return {
                success: true,
                orderId: orderId,
                message: '支付成功'
            };
        },
        
        /**
         * 保存订单
         * @private
         */
        saveOrder(order) {
            const orders = JSON.parse(localStorage.getItem('payment_orders') || '[]');
            const index = orders.findIndex(o => o.orderId === order.orderId);
            
            if (index >= 0) {
                orders[index] = order;
            } else {
                orders.push(order);
            }
            
            localStorage.setItem('payment_orders', JSON.stringify(orders));
        },
        
        /**
         * 检查支付状态
         * @param {string} orderId - 订单ID
         * @returns {Promise<object>} 支付状态
         */
        async checkPaymentStatus(orderId) {
            await Utils.sleep(500);
            
            const orders = JSON.parse(localStorage.getItem('payment_orders') || '[]');
            const order = orders.find(o => o.orderId === orderId);
            
            return order || null;
        },
        
        /**
         * 生成支付二维码显示
         * @param {object} paymentInfo - 支付信息
         * @returns {string} HTML内容
         */
        generateQRCodeDisplay(paymentInfo) {
            if (!paymentInfo || paymentInfo.type !== 'qrcode') {
                return '<div class="message-error">支付信息无效</div>';
            }
            
            // 实际中使用第三方库生成二维码，这里用图片代替
            let qrCodeUrl = '';
            if (paymentInfo.data.includes('weixin')) {
                qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + 
                            encodeURIComponent('请使用微信支付扫描二维码');
            } else {
                qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + 
                            encodeURIComponent('请使用支付宝支付扫描二维码');
            }
            
            return `
                <div style="text-align: center; padding: 20px;">
                    <div style="margin-bottom: 20px;">
                        <h3>请扫描二维码支付</h3>
                        <p style="color: #666;">订单金额：<strong>${Utils.formatMoney(paymentInfo.amount)}</strong></p>
                        <p style="color: #999; font-size: 0.9rem;">${paymentInfo.instructions}</p>
                    </div>
                    
                    <div style="margin: 20px 0;">
                        <img src="${qrCodeUrl}" 
                             style="width: 200px; height: 200px; border: 1px solid #eee;"
                             alt="支付二维码">
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="window.Platform.Payment.simulateMockPayment('${paymentInfo.data.split('=')[1] || ''}')">
                            <i class="fas fa-bolt"></i> 模拟支付成功
                        </button>
                    </div>
                    
                    <div style="margin-top: 10px; font-size: 0.8rem; color: #999;">
                        注：此为演示页面，实际支付请使用真实支付
                    </div>
                </div>
            `;
        }
    };
    
    // ========================================
    // 内容管理系统
    // ========================================
    const ContentManager = {
        /**
         * 获取专栏列表
         * @returns {Promise<Array>} 专栏列表
         */
        async getColumns() {
            await Utils.sleep(300);
            
            return [
                {
                    id: 'civil-engineering',
                    title: '土木工程AI问答专栏',
                    description: '专业土木施工技术问答与工具',
                    icon: '🏗️',
                    tags: ['施工技术', '工程问答', '行业规范', '实用工具'],
                    stats: {
                        documents: 8,
                        tools: 3,
                        members: 120,
                        rating: 4.8
                    },
                    pricing: {
                        monthly: 29,
                        yearly: 99
                    },
                    features: [
                        '每周施工工艺专业文档',
                        '专业Excel计算工具下载',
                        '一对一技术问题解答',
                        '行业标准规范更新',
                        '施工经验分享会参与',
                        '新用户专享免费资料'
                    ]
                }
            ];
        },
        
        /**
         * 获取专栏内容
         * @param {string} columnId - 专栏ID
         * @param {number} page - 页码
         * @returns {Promise<object>} 内容列表
         */
        async getColumnContent(columnId, page = 1) {
            await Utils.sleep(300);
            
            // 检查用户权限
            const hasAccess = UserManager.hasValidSubscription(columnId);
            const user = UserManager.getCurrentUser();
            
            // 获取内容（这里模拟一些内容）
            const allContent = this.generateMockContent(columnId);
            
            // 区分免费内容和付费内容
            const freeContent = allContent.slice(0, CONFIG.content.freeItems);
            const paidContent = allContent.slice(CONFIG.content.freeItems);
            
            let accessibleContent = freeContent;
            
            if (hasAccess) {
                // 订阅用户可访问所有内容
                accessibleContent = [...freeContent, ...paidContent];
            } else if (user) {
                // 登录用户可访问部分免费内容
                accessibleContent = user.freeContentAccessed >= CONFIG.content.freeItems ? 
                    [] : freeContent.slice(0, CONFIG.content.freeItems - user.freeContentAccessed);
            }
            
            // 分页
            const startIndex = (page - 1) * CONFIG.content.itemsPerPage;
            const endIndex = startIndex + CONFIG.content.itemsPerPage;
            const paginatedContent = accessibleContent.slice(startIndex, endIndex);
            
            return {
                content: paginatedContent,
                total: accessibleContent.length,
                page: page,
                totalPages: Math.ceil(accessibleContent.length / CONFIG.content.itemsPerPage),
                hasMore: accessibleContent.length > endIndex,
                access: {
                    hasSubscription: hasAccess,
                    freeContentRemaining: hasAccess ? 0 : Math.max(0, CONFIG.content.freeItems - (user?.freeContentAccessed || 0))
                }
            };
        },
        
        /**
         * 访问内容项
         * @param {string} contentId - 内容ID
         * @returns {Promise<object>} 内容详情
         */
        async accessContent(contentId) {
            await Utils.sleep(200);
            
            // 检查内容权限
            const content = this.getContentById(contentId);
            if (!content) {
                throw new Error('内容不存在');
            }
            
            const user = UserManager.getCurrentUser();
            const hasAccess = UserManager.hasValidSubscription(content.columnId);
            
            if (content.isFree || hasAccess) {
                // 记录访问历史
                if (user) {
                    this.recordAccessHistory(user.id, contentId);
                    
                    // 如果是免费内容，更新计数
                    if (content.isFree) {
                        user.freeContentAccessed = (user.freeContentAccessed || 0) + 1;
                        UserManager.setCurrentUser(user);
                    }
                }
                
                return content;
            } else {
                throw new Error('需要订阅才能访问此内容');
            }
        },
        
        /**
         * 生成模拟内容
         * @private
         */
        generateMockContent(columnId) {
            const topics = [
                { title: '混凝土浇筑完整流程', tags: ['混凝土', '施工工艺'], isFree: true },
                { title: '钢筋工程施工要点', tags: ['钢筋', '钢结构'], isFree: true },
                { title: '模板工程施工规范', tags: ['模板', '支撑系统'] },
                { title: '脚手架搭设与验收', tags: ['脚手架', '安全'] },
                { title: '地基处理技术详解', tags: ['地基', '基础'] },
                { title: '施工测量放线指南', tags: ['测量', '放线'] },
                { title: '工程质量验收标准', tags: ['质量', '验收'] },
                { title: '施工现场安全管理', tags: ['安全', '管理'] }
            ];
            
            const tools = [
                { title: '混凝土方量计算器', type: 'excel', tags: ['计算工具'], isFree: false },
                { title: '钢筋下料表生成器', type: 'excel', tags: ['计算工具'] },
                { title: '施工进度计划模板', type: 'excel', tags: ['管理工具'] }
            ];
            
            return [...topics, ...tools].map((item, index) => ({
                id: `${columnId}-${index + 1}`,
                columnId: columnId,
                title: item.title,
                type: item.type || 'article',
                description: `关于${item.title}的详细讲解和实用技巧`,
                tags: item.tags,
                author: '心愿 工程师',
                createdAt: `2026-04-${String(15 - index).padStart(2, '0')}`,
                readTime: `${10 + index * 5}分钟`,
                isFree: item.isFree || false,
                viewCount: Math.floor(Math.random() * 500) + 100,
                content: this.generateMockContentText(item.title)
            }));
        },
        
        /**
         * 生成模拟内容文本
         * @private
         */
        generateMockContentText(title) {
            return `
                <h2>${title}</h2>
                <p>本文详细讲解${title}的相关技术要点、操作流程和注意事项。内容基于实际工程经验编写，具有很高的实用价值。</p>
                
                <h3>主要内容包括：</h3>
                <ul>
                    <li>基本原理和理论依据</li>
                    <li>标准操作流程详解</li>
                    <li>常见问题及解决方案</li>
                    <li>质量控制要点</li>
                    <li>安全注意事项</li>
                </ul>
                
                <h3>实际应用案例：</h3>
                <p>以某实际工程为例，说明如何有效应用${title}的技术要点，提升工程质量和效率。</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>💡 实用建议：</strong>
                    <p>在实际应用中，建议结合具体工程条件灵活调整，并严格遵守相关规范和标准。</p>
                </div>
                
                <h3>下载资源：</h3>
                <p>本文附件包含相关的计算表格和检查清单，供读者参考使用。</p>
            `;
        },
        
        /**
         * 获取内容详情
         * @private
         */
        getContentById(contentId) {
            // 模拟从所有内容中查找
            const allContent = this.generateMockContent('civil-engineering');
            return allContent.find(c => c.id === contentId);
        },
        
        /**
         * 记录访问历史
         * @private
         */
        recordAccessHistory(userId, contentId) {
            const historyKey = `content_history_${userId}`;
            const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
            
            const record = {
                contentId: contentId,
                accessedAt: new Date().toISOString()
            };
            
            history.unshift(record);
            
            // 只保留最近50条记录
            localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 50)));
        }
    };
    
    // ========================================
    // 初始化 & 全局暴露
    // ========================================
    window.Platform = {
        Config: CONFIG,
        Utils: Utils,
        User: UserManager,
        Payment: PaymentManager,
        Content: ContentManager,
        
        /**
         * 初始化平台
         */
        async init() {
            // 检查用户登录状态
            const user = UserManager.getCurrentUser();
            if (user) {
                console.log(`欢迎回来，${user.displayName}!`);
                
                // 更新UI显示登录状态
                this.updateLoginUI(user);
            }
            
            // 初始化UI事件
            this.initUIEvents();
            
            // 检查订阅提醒
            this.checkSubscriptionReminders();
            
            console.log('🎉 心愿智库学习平台 v' + CONFIG.platform.version + ' 初始化完成');
        },
        
        /**
         * 更新登录状态UI
         */
        updateLoginUI(user) {
            const loginBtn = document.querySelector('.btn-login');
            const userMenu = document.querySelector('.user-menu');
            
            if (loginBtn && userMenu) {
                loginBtn.style.display = 'none';
                userMenu.style.display = 'flex';
                
                const userNameEl = userMenu.querySelector('.username');
                if (userNameEl) {
                    userNameEl.textContent = user.displayName;
                }
            }
        },
        
        /**
         * 初始化UI事件
         */
        initUIEvents() {
            // 订阅按钮点击事件
            document.addEventListener('click', function(e) {
                if (e.target.matches('.subscribe-btn, .subscribe-btn *')) {
                    const plan = e.target.closest('.subscribe-btn').dataset.plan;
                    if (plan) {
                        window.Platform.handleSubscribe(plan);
                    }
                }
            });
            
            // 内容访问按钮
            document.addEventListener('click', function(e) {
                if (e.target.matches('.access-content-btn, .access-content-btn *')) {
                    const contentId = e.target.closest('.access-content-btn').dataset.contentId;
                    if (contentId) {
                        window.Platform.accessContent(contentId);
                    }
                }
            });
        },
        
        /**
         * 处理订阅流程
         */
        async handleSubscribe(planType) {
            // 检查登录状态
            const user = UserManager.getCurrentUser();
            if (!user) {
                Utils.showMessage('请先登录后再订阅', 'warning');
                
                // 保存订阅意图，登录后继续
                localStorage.setItem('pending_subscription', planType);
                
                // 跳转到登录页
                window.location.href = 'login.html?redirect=subscribe';
                return;
            }
            
            // 检查是否已有有效订阅
            if (UserManager.hasValidSubscription('civil-engineering')) {
                const confirm = window.confirm('您已订阅此专栏，是否续订或升级？');
                if (!confirm) return;
            }
            
            // 跳转到支付页面
            window.location.href = `subscribe.html?plan=${planType}`;
        },
        
        /**
         * 访问内容
         */
        async accessContent(contentId) {
            try {
                const content = await ContentManager.accessContent(contentId);
                
                // 保存当前访问的内容
                sessionStorage.setItem('current_content', JSON.stringify(content));
                
                // 跳转到内容页面
                window.location.href = `content.html?id=${contentId}`;
                
            } catch (error) {
                Utils.showMessage(error.message, 'error');
                
                // 如果需要订阅，引导到订阅页
                if (error.message.includes('需要订阅')) {
                    setTimeout(() => {
                        window.location.href = 'subscribe.html';
                    }, 1500);
                }
            }
        },
        
        /**
         * 检查订阅提醒
         */
        checkSubscriptionReminders() {
            const reminders = JSON.parse(localStorage.getItem('subscription_reminders') || '[]');
            const now = new Date();
            
            reminders.forEach(reminder => {
                if (!reminder.notified && new Date(reminder.reminderDate) <= now) {
                    // 显示提醒
                    Utils.showMessage('您的订阅即将到期，请及时续订以保证服务连续。', 'warning', 8000);
                    
                    // 标记为已提醒
                    reminder.notified = true;
                }
            });
            
            localStorage.setItem('subscription_reminders', JSON.stringify(reminders));
        },
        
        /**
         * 模拟支付成功（测试用）
         */
        async simulateMockPayment(orderId) {
            try {
                const result = await PaymentManager.simulatePayment(orderId);
                Utils.showMessage('模拟支付成功，订阅已开通！', 'success');
                
                // 跳转到成功页面
                setTimeout(() => {
                    window.location.href = 'success.html?order=' + orderId;
                }, 1500);
                
            } catch (error) {
                Utils.showMessage(error.message, 'error');
            }
        }
    };
    
    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            window.Platform.init();
        }, 100);
    });
    
    // 全局错误处理
    window.addEventListener('error', function(e) {
        if (CONFIG.platform.debug) {
            console.error('平台错误:', e.error);
        }
    });
    
    // 防止表单意外提交
    document.addEventListener('submit', function(e) {
        if (e.target.tagName === 'FORM') {
            e.preventDefault();
            
            // 查找提交按钮
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
                
                // 模拟处理时间后恢复
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = submitBtn.dataset.originalText || '提交';
                }, 2000);
            }
        }
    });
    
})();

// 全局辅助函数（简化版）
window.loginUser = function(username, password) {
    return window.Platform.User.login(username, password);
};

window.logoutUser = function() {
    window.Platform.User.logout();
};

window.getCurrentUser = function() {
    return window.Platform.User.getCurrentUser();
};

window.hasSubscription = function() {
    return window.Platform.User.hasValidSubscription();
};

// 开发工具
if (typeof console !== 'undefined') {
    console.log(`
        🔧 心愿智库学习平台开发工具已加载
        📊 版本：${window.Platform?.Config?.platform?.version || '未知'}
        👤 当前用户：${window.getCurrentUser()?.displayName || '未登录'}
        🔗 可用命令：getCurrentUser(), loginUser(), logoutUser(), hasSubscription()
    `);
}