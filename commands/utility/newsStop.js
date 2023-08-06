const fs = require('fs');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { dataFilePath } = require('../../config.json');

async function getJson(url) {
    return new Promise((resolve, reject) => {
        fs.readFile(url, 'utf8', function readFileCallback(err, data) {
            if (err) {
                reject(err);
            }
            else {
                let dataJson = null;

                try {
                    dataJson = JSON.parse(data);
                } catch (error) {
                    log('cannot turn into json URL: ' + url);
                    reject(error);
                }

                resolve(dataJson);
            }
        });
    });
}

async function saveJson(url, data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(url, JSON.stringify(data).replace(/},{/g, '},\n{'), 'utf8', function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve(true);
            }
        });
    });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('news-stop')
		.setDescription('Stops posting news in this server!')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDMPermission(false),
	async execute(interaction) {
        dataFile = await getJson(dataFilePath);
        delete dataFile.guildsToUpdate[interaction.guildId];
        await saveJson(dataFilePath, dataFile);
        await interaction.reply('Pfft! Fine, more free time for me! No more news!');
	},
};