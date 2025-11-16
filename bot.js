require('dotenv').config();

const { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const TOKEN = process.env.TOKEN;
const VOICE_CHANNELS = process.env.VOICE_CHANNELS ? process.env.VOICE_CHANNELS.split(',') : [];
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;

// Хранилище активных тикетов
const activeTickets = new Map();
const activeTimers = new Map();
let ticketCounter = 1;

// Серверы GTA5RP
const servers = [
    { name: 'DOWNTOWN', emoji: '🏛️', short: 'DT' },
    { name: 'STRAWBERRY', emoji: '🍓', short: 'SB' },
    { name: 'VINEWOOD', emoji: '🏛️', short: 'VW' },
    { name: 'BLACKBERRY', emoji: '🦋', short: 'BB' },
    { name: 'INSQUAD', emoji: '🎮', short: 'IS' },
    { name: 'SUNRISE', emoji: '🌅', short: 'SR' },
    { name: 'RAINBOW', emoji: '🌈', short: 'RB' },
    { name: 'RICHMAN', emoji: '💰', short: 'RM' },
    { name: 'ECLIPSE', emoji: '🌑', short: 'EC' },
    { name: 'LA MESA', emoji: '🍀', short: 'LM' },
    { name: 'BURTON', emoji: '🏬', short: 'BT' },
    { name: 'ROCKFORD', emoji: '💎', short: 'RF' },
    { name: 'ALTA', emoji: '☘️', short: 'AL' },
    { name: 'DEL PERRO', emoji: '🎯', short: 'DP' },
    { name: 'DAVIS', emoji: '🏀', short: 'DV' },
    { name: 'HARMONY', emoji: '🌸', short: 'HM' },
    { name: 'REDWOOD', emoji: '🌲', short: 'RW' },
    { name: 'HAWICK', emoji: '🎲', short: 'HW' },
    { name: 'GRAPESEED', emoji: '🌱', short: 'GS' },
    { name: 'MURRIETA', emoji: '🌹', short: 'MR' },
    { name: 'VESPUCCI', emoji: '🏖️', short: 'VS' },
    { name: 'MILTON', emoji: '🍸', short: 'ML' }
];

client.once('clientReady', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`🎰 Готов к приему заявок на ${servers.length} серверов`);
    console.log(`🎙️ Отслеживаются голосовые каналы: ${VOICE_CHANNELS.join(', ')}`);
});

// Отслеживание входа в голосовые каналы
client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.member.id;
    
    // Проверяем, зашел ли пользователь в нужный голосовой канал
    if (newState.channelId && VOICE_CHANNELS.includes(newState.channelId)) {
        // Находим тикет этого пользователя
        for (const [channelId, ticketData] of activeTickets.entries()) {
            if (ticketData.userId === userId && ticketData.queuePosition === 1) {
                // Отменяем таймер
                if (activeTimers.has(userId)) {
                    clearTimeout(activeTimers.get(userId));
                    activeTimers.delete(userId);
                    console.log(`✅ Пользователь ${ticketData.username} зашел в голосовой канал`);
                    
                    // Отправляем уведомление в тикет
                    client.channels.fetch(channelId).then(channel => {
                        const successEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ Игрок присоединился!')
                            .setDescription(`**${newState.member} зашел в голосовой канал!**\n\n` +
                                `> 🎙️ Канал: <#${newState.channelId}>\n` +
                                `> 🎮 Приятной игры!\n\n` +
                                `*Тикет останется открытым для общения.*`)
                            .setTimestamp();
                        
                        channel.send({ embeds: [successEmbed] });
                    }).catch(console.error);
                }
                break;
            }
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content.toLowerCase() === '!тикет') {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎰 Система тикетов Good Casino')
            .setDescription('**Добро пожаловать в систему бронирования игры в казино!**\n\n' +
                '> 💎 **Условия игры:**\n' +
                '> • Минимальный депозит: **250,000$**\n' +
                '> • Комиссия: **15% от выигрыша** (с учетом депозита)\n\n' +
                '> 📋 **Как это работает:**\n' +
                '> 1. Нажмите на кнопку ниже\n' +
                '> 2. Заполните форму заявки\n' +
                '> 3. Дождитесь своей очереди\n' +
                '> 4. Зайдите в голосовой канал\n\n' +
                '**Нажмите 📧 для создания тикета**')
            .setThumbnail('https://i.postimg.cc/QN6Prv44/logo.png')
            .setFooter({ text: '🎲 Good Casino • Честная игра с прозрачными условиями' })
            .setTimestamp();

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Создать заявку')
                    .setEmoji('📧')
                    .setStyle(ButtonStyle.Success)
            );

        await message.channel.send({ embeds: [embed], components: [button] });
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        // Кнопка создания тикета
        if (interaction.isButton() && interaction.customId === 'create_ticket') {
            const serverOptions = servers.map(server => ({
                label: server.name,
                value: server.short,
                emoji: server.emoji
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_server')
                .setPlaceholder('🎮 Выберите сервер для игры')
                .addOptions(serverOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📝 Создание заявки на игру')
                .setDescription('**⚠️ Важная информация:**\n' +
                    '> Эта форма создаст приватный канал для вашей заявки.\n' +
                    '> Никогда не делитесь паролями или личной информацией!\n\n' +
                    '**Шаг 1 из 2:** Выберите сервер из списка ниже ⬇️')
                .setFooter({ text: 'Good Casino System' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // Выбор сервера
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_server') {
            const selectedServerShort = interaction.values[0];
            const server = servers.find(s => s.short === selectedServerShort);

            const modal = new ModalBuilder()
                .setCustomId(`ticket_form_${server.short}`)
                .setTitle('📋 Заявка на игру');

            const depositInput = new TextInputBuilder()
                .setCustomId('deposit')
                .setLabel('Депозит *')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Например: 500000')
                .setRequired(true)
                .setMinLength(6)
                .setMaxLength(10);

            const serverInput = new TextInputBuilder()
                .setCustomId('server_name')
                .setLabel('Сервер')
                .setStyle(TextInputStyle.Short)
                .setValue(`${server.emoji} ${server.name}`)
                .setRequired(false);

            const datetimeInput = new TextInputBuilder()
                .setCustomId('datetime')
                .setLabel('Время / дата')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Например: Сегодня в 20:00 или 15.11.2025')
                .setRequired(false);

            const withdrawInput = new TextInputBuilder()
                .setCustomId('withdraw')
                .setLabel('Желаемый вывод')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Например: 1000000')
                .setRequired(false);

            const percentAgreement = new TextInputBuilder()
                .setCustomId('percent_agreement')
                .setLabel('Ознакомлены ли с процентами')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Да / Нет')
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(3);

            modal.addComponents(
                new ActionRowBuilder().addComponents(depositInput),
                new ActionRowBuilder().addComponents(serverInput),
                new ActionRowBuilder().addComponents(datetimeInput),
                new ActionRowBuilder().addComponents(withdrawInput),
                new ActionRowBuilder().addComponents(percentAgreement)
            );

            await interaction.showModal(modal);
        }

        // Обработка отправки формы
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
            const serverShort = interaction.customId.split('_')[2];
            const server = servers.find(s => s.short === serverShort);

            const deposit = interaction.fields.getTextInputValue('deposit');
            const datetime = interaction.fields.getTextInputValue('datetime') || 'Не указано';
            const withdraw = interaction.fields.getTextInputValue('withdraw') || 'Не указано';
            const percentAgreement = interaction.fields.getTextInputValue('percent_agreement');

            await interaction.deferReply({ ephemeral: true });

            // Проверка депозита
            const depositAmount = parseInt(deposit.replace(/\D/g, ''));
            if (depositAmount < 250000) {
                await interaction.editReply({ 
                    content: '❌ **Ошибка:** Минимальный депозит составляет **250,000$**', 
                    ephemeral: true 
                });
                return;
            }

            // Создаем приватный канал для тикета
            const channelOptions = {
                name: `🎰┃${server.short}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                    }
                ]
            };

            if (TICKET_CATEGORY_ID) {
                channelOptions.parent = TICKET_CATEGORY_ID;
            }

            const ticketChannel = await interaction.guild.channels.create(channelOptions);

            // Сохраняем информацию о тикете
            const queuePosition = activeTickets.size + 1;
            activeTickets.set(ticketChannel.id, {
                userId: interaction.user.id,
                username: interaction.user.username,
                server: server,
                ticketNumber: ticketCounter,
                createdAt: Date.now(),
                queuePosition: queuePosition,
                notified: false,
                deposit: deposit,
                datetime: datetime,
                withdraw: withdraw
            });

            ticketCounter++;

            // Embed с информацией о тикете
            const ticketEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle(`${server.emoji} Тикет #${ticketCounter - 1}`)
                .setDescription(`**Добро пожаловать, ${interaction.user}!**\n\n` +
                    `Ваша заявка успешно создана и находится в обработке.\n\n` +
                    `╔═══════════════════════════╗\n` +
                    `║ 📊 **ИНФОРМАЦИЯ О ЗАЯВКЕ** ║\n` +
                    `╚═══════════════════════════╝\n\n` +
                    `> 🎮 **Сервер:** ${server.emoji} \`${server.name}\`\n` +
                    `> 💰 **Депозит:** \`${deposit}$\`\n` +
                    `> 🎯 **Желаемый вывод:** \`${withdraw}$\`\n` +
                    `> 📅 **Время/дата:** \`${datetime}\`\n` +
                    `> ✅ **Ознакомлены с %:** \`${percentAgreement}\`\n\n` +
                    `╔═══════════════════════════╗\n` +
                    `║ 🎫 **СТАТУС ОЧЕРЕДИ**      ║\n` +
                    `╚═══════════════════════════╝\n\n` +
                    `> 📍 **Позиция в очереди:** \`#${queuePosition}\`\n` +
                    `> ⏰ **Время создания:** <t:${Math.floor(Date.now() / 1000)}:R>\n\n` +
                    `╔═══════════════════════════╗\n` +
                    `║ 📋 **ИНСТРУКЦИЯ**          ║\n` +
                    `╚═══════════════════════════╝\n\n` +
                    `\`\`\`\n` +
                    `1️⃣ Дождитесь своей очереди\n` +
                    `2️⃣ Следите за обновлениями в этом канале\n` +
                    `3️⃣ При наступлении очереди вас пингуют\n` +
                    `4️⃣ Зайдите в голосовой канал в течение 5 минут\n` +
                    `5️⃣ Если не ответите - тикет будет закрыт\n` +
                    `\`\`\`\n\n` +
                    `╔═══════════════════════════╗\n` +
                    `║ 💎 **УСЛОВИЯ ИГРЫ**        ║\n` +
                    `╚═══════════════════════════╝\n\n` +
                    `> • Минимальный депозит: **250,000$**\n` +
                    `> • Комиссия: **15% от выигрыша** (учитывая депозит)\n` +
                    `> • Честная игра с прозрачными условиями\n\n` +
                    `*Спасибо за выбор Good Casino! Желаем удачи! 🍀*`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: `Тикет создан пользователем ${interaction.user.username}` })
                .setTimestamp();

            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Закрыть тикет')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('ticket_info')
                        .setLabel('Обновить статус')
                        .setEmoji('🔄')
                        .setStyle(ButtonStyle.Primary)
                );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [ticketEmbed], components: [buttonRow] });

            await interaction.editReply({ 
                content: `✅ **Заявка успешно создана!**\n\n🎫 Ваш тикет: ${ticketChannel}\n📊 Позиция в очереди: \`#${queuePosition}\``, 
                ephemeral: true 
            });

            updateAllTicketQueues();
        }

        // Кнопка обновления статуса
        if (interaction.isButton() && interaction.customId === 'ticket_info') {
            const ticketData = activeTickets.get(interaction.channel.id);
            
            if (ticketData) {
                const statusEmbed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('🔄 Обновление статуса')
                    .setDescription(`**Текущий статус вашей заявки:**\n\n` +
                        `> 📍 **Позиция в очереди:** \`#${ticketData.queuePosition}\`\n` +
                        `> ⏳ **Время ожидания:** <t:${Math.floor(ticketData.createdAt / 1000)}:R>\n` +
                        `> 🎮 **Сервер:** ${ticketData.server.emoji} \`${ticketData.server.name}\`\n\n` +
                        (ticketData.queuePosition === 1 ? 
                            `🔔 **Ваша очередь подошла! Ожидаем вас в голосовом канале!**` : 
                            `⏰ Пожалуйста, ожидайте. Впереди вас: \`${ticketData.queuePosition - 1}\` заявок.`))
                    .setTimestamp();

                await interaction.reply({ embeds: [statusEmbed], ephemeral: true });
            }
        }

        // Кнопка закрытия тикета
        if (interaction.isButton() && interaction.customId === 'close_ticket') {
            const ticketData = activeTickets.get(interaction.channel.id);
            
            if (ticketData) {
                // Отменяем таймер если он есть
                if (activeTimers.has(ticketData.userId)) {
                    clearTimeout(activeTimers.get(ticketData.userId));
                    activeTimers.delete(ticketData.userId);
                }
                
                activeTickets.delete(interaction.channel.id);
                
                const closeEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('🔒 Закрытие тикета')
                    .setDescription('**Тикет закрывается...**\n\nСпасибо за использование Good Casino!\nНадеемся увидеть вас снова! 🎰')
                    .setTimestamp();

                await interaction.reply({ embeds: [closeEmbed] });
                
                setTimeout(async () => {
                    await interaction.channel.delete();
                    updateAllTicketQueues();
                }, 3000);
            }
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
});

// Функция обновления очереди
async function updateAllTicketQueues() {
    let position = 1;
    
    for (const [channelId, ticketData] of activeTickets.entries()) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            activeTickets.delete(channelId);
            continue;
        }

        ticketData.queuePosition = position;
        
        // Если это первый в очереди и еще не уведомлен
        if (position === 1 && !ticketData.notified) {
            ticketData.notified = true;
            
            const user = await client.users.fetch(ticketData.userId).catch(() => null);
            if (user) {
                const voiceChannelsList = VOICE_CHANNELS.map(id => `<#${id}>`).join(' або ');
                
                const notifyEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🔔 ВАША ОЧЕРЕДЬ!')
                    .setDescription(`${user} **Ваша очередь подошла!**\n\n` +
                        `╔═══════════════════════════╗\n` +
                        `║ ⚠️ **ВАЖНО! ПРОЧИТАЙТЕ!** ║\n` +
                        `╚═══════════════════════════╝\n\n` +
                        `> ⏰ У вас есть **5 минут**, чтобы зайти в голосовой канал:\n` +
                        `> ${voiceChannelsList}\n\n` +
                        `> ⚠️ **Если вы не зайдете в течение 5 минут:**\n` +
                        `> • Тикет будет автоматически закрыт\n` +
                        `> • Вам придется создать новую заявку\n\n` +
                        `**🎮 Приготовьтесь к игре и удачи! 🍀**`)
                    .setThumbnail('https://i.postimg.cc/QN6Prv44/logo.png')
                    .setFooter({ text: 'Good Casino • Система очереди' })
                    .setTimestamp();

                await channel.send({ content: `${user} 🔔`, embeds: [notifyEmbed] });

                // Устанавливаем таймер на 5 минут
                const timerId = setTimeout(async () => {
                    if (activeTickets.has(channelId) && activeTickets.get(channelId).queuePosition === 1) {
                        const timeoutEmbed = new EmbedBuilder()
                            .setColor('#E74C3C')
                            .setTitle('⏱️ Время истекло!')
                            .setDescription('**К сожалению, время ожидания истекло.**\n\n' +
                                '> ❌ Вы не зашли в голосовой канал в течение 5 минут\n' +
                                '> 🔒 Тикет будет закрыт автоматически\n\n' +
                                '*Вы можете создать новую заявку командой `!тикет`*')
                            .setTimestamp();

                        await channel.send({ embeds: [timeoutEmbed] });
                        setTimeout(() => {
                            channel.delete().catch(console.error);
                            activeTickets.delete(channelId);
                            activeTimers.delete(ticketData.userId);
                            updateAllTicketQueues();
                        }, 5000);
                    }
                }, 5 * 60 * 1000);

                // Сохраняем ID таймера
                activeTimers.set(ticketData.userId, timerId);
            }
        }
        
        position++;
    }
}

client.login(TOKEN);