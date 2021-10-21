const fs = require('fs');
const ms = require('ms');
const Discord = require('discord.js');
const db = require('quick.db');
var { prefix, token } = require('./config.json');
const client = new Discord.Client();
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args, client));
	} else {
		client.on(event.name, (...args) => event.execute(...args, client));
	}
}
let blacklist = [];
client.commands = new Discord.Collection();
client.cooldowns = new Discord.Collection();
const commandFolders = fs.readdirSync('./commands');
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const folder of commandFolders) {
	const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		client.commands.set(command.name, command);
	}
}

const distube = require('distube');
client.distube = new distube(client, { searchSongs: false, emitNewSongOnly: true })
client.distube
	.on('playSong', (message, queue, song) => {
        const embed = new Discord.MessageEmbed()
			.setTitle(`\`🎶\` Playing **${song.name}**`)
        	.setURL(song.link)
        	.setThumbnail(song.thumbnail)
        	.addFields(
                { name: "Duration", value: `\`${song.formattedDuration}\``, inline: true },
                { name: "Link", value: `${song.url}`, inline: true },
                { name: "Likes", value: `\`${String(song.likes).replace(/(.)(?=(\d{3})+$)/g,'$1,')}\``, inline: true },
                { name: "Dislikes", value: `\`${String(song.dislikes).replace(/(.)(?=(\d{3})+$)/g,'$1,')}\``, inline: true },
                { name: "Views", value: `\`${String(song.views).replace(/(.)(?=(\d{3})+$)/g,'$1,')}\``, inline: true },
            )
        	.setColor('5124e3')
        	.setAuthor(`${message.author.username}`, message.author.avatarURL())
        	.setTimestamp()
    	message.channel.send(embed)
			})
	.on('addSong', (message, queue, song) => {
        const embed = new Discord.MessageEmbed()
			.setTitle(`\`🎶\` Added **${song.name}** to the queue`)
        	.setURL(song.link)
        	.setThumbnail(song.thumbnail)
        	.addFields(
                { name: "Duration", value: `\`${song.formattedDuration}\``, inline: true },
                { name: "Requested By", value: `${song.user}`, inline: true },
            )
        	.setColor('5124e3')
        	.setAuthor(`${message.author.username}`, message.author.avatarURL())
        	.setTimestamp()
    	message.channel.send(embed)
			})
	.on('error', (message, e) => {
		console.error(e)
		message.reply(`**I ran into an error:** \`${e}\``)
	})

const { GiveawaysManager } = require('discord-giveaways');

const manager = new GiveawaysManager(client, {
    updateCountdownEvery: 10000,
    hasGuildMembersIntent: false,
    default: {
        botsCanWin: false,
        embedColor: '#2F3136',
        embedColorEnd: '#000000',
        reaction: '🎉'
    }
});

client.giveawaysManager = manager;

client.on('message', message => {
	try {
		let prefixes = db.get(`prefix_${message.guild.id}`);
		if (!prefixes) {
			prefix = "-"
		} else {
            if (message.channel.type == 'dm') {
                
            } else {
                prefix = prefixes;
            }
    }
	} catch (err) {
		console.log(err);
	}

	if (message.mentions.has(client.user.id)) {
		if (message.author.bot) return;
    	if (message.content.includes("@here") || message.content.includes("@everyone")) return;
        const mentionedever = db.get(`user_mentioned_${message.author.id}_${message.guild.id}`) || false;
        if (mentionedever === false) {
         const mentionedEmbed = new Discord.MessageEmbed()
			.setDescription(`**Hey!** I'm ${client.user.username}.\nI'm a music bot that fits all your needs. I'm designed to be lighthearted and fun to use.\nMy prefix is: \`-\`\nRun **${prefix}help** to see my commands! To get support, join [Axdroid Support](https://discord.gg/4WNkANWSbK)`)
			.setTimestamp()
        	.setFooter(`Welcome to ${client.user.username}!`)
		message.channel.send(mentionedEmbed);   
        db.set(`user_mentioned_${message.author.id}_${message.guild.id}`, true)
        } else if (mentionedever === true) {
            const mentionedEmbed = new Discord.MessageEmbed()
			.setDescription(`**Hey!** I'm ${client.user.username}.\nI'm a music bot that fits all your needs. I'm designed to be lighthearted and fun to use.\nMy prefix is: \`-\`\nRun **${prefix}help** to see my commands! To get support, join [Axdroid Support](https://discord.gg/4WNkANWSbK)`)
			.setTimestamp()
        	.setFooter("I have been summoned")
		message.channel.send(mentionedEmbed);
        }
	}
	if (!message.content.startsWith(prefix) || message.author.bot) return;
	
    for (let value of blacklist) {
        if (value === message.author.id) {
            return;
    }
    }
    
	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	if (!client.commands.has(commandName)) return;
	const command = client.commands.get(commandName) || client.commands.find(c => c.aliases && c.aliases.includes(commandName));
	if (!command) {
		return message.reply("EEEE");
	}
	if (command.guildOnly && message.channel.type === 'dm') {
		const dmerrorEmbed = new Discord.MessageEmbed()
			.setDescription('❌ This command cannot be executed in DMs!')
			.setTimestamp()
		message.channel.send(dmerrorEmbed);
	}

	if (command.permissions) {
		try {
			if (!message.member.hasPermission(command.permissions)) {
				const permserrorEmbed = new Discord.MessageEmbed()
				.setDescription(`❌ You do not have the permissions for the **${command.name}** command!`)
			.setTimestamp()
			return message.reply(permserrorEmbed);
			}
		} catch (err) {
			console.log(err);
		}
	}

	if (command.args && !args.length) {
		let usage = ''

		if (command.usage) {
			usage += `${prefix}${command.name} ${command.usage}`
		} else {
			usage += "**No usage.**"
		}

		user = message.author
		const missingArgsEmbed = new Discord.MessageEmbed()
			.setDescription(`❌ Incorrect command usage for **${command.name}**\nUsage: \`${usage}\``)
			.setTimestamp()
		return message.channel.send(missingArgsEmbed);
	}

	const { cooldowns } = client;

	if (!cooldowns.has(command.name)) {
		cooldowns.set(command.name, new Discord.Collection());
	}

	const now = Date.now();
	const timestamps = cooldowns.get(command.name);
	const cooldownAmount = (command.cooldown || 3) * 1000;

	if (timestamps.has(message.author.id)) {
		const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

		if (now < expirationTime) {
			const timeLeft = (expirationTime - now) / 1000;
			return message.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before using the **\`${command.name}\`** command again!`);
		}
	}

	timestamps.set(message.author.id, now);
	setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

	try {
        if (command.premium) {
            const premium = db.get(`user_premium_${message.author.id}`);
            if (!premium || premium === 'false') {
                return message.reply("only users with premium may use this command!")
            } else if (premium === 'true') {
                command.execute(message, args);
            } else {
                return;
            }
        } else {
            command.execute(message, args);
        }
	} catch (error) {
		console.error(error);
	}
});

client.on('clickButton', async (button) => {
    if (parseInt(button.clicker.member.id) !== 804777320123990108) return;
    if (button.id === "btntest1") {
		button.channel.send("✅ **API Authorized:** my endpoint ID has successfully been connected to.")
	}
});

client.login(token);



const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(
    "Hi"  );
});

app.listen(port, () => {
  console.log(`Axdroid is now ready`);
});






