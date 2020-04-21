const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'));

let abstracts = [];
let components = [];
let layouts = [];
let stylesPath;

// Gets all defaults and pushes them to arrays used for options
async function initDefaults() {
    const abstractDefaults = await getFilesInDir(getDefaultsPath('abstracts'));
    abstracts.push(...abstractDefaults);

    const componentDefaults = await getFilesInDir(getDefaultsPath('components'));
    components.push(...componentDefaults);

    const layoutDefaults = await getFilesInDir(getDefaultsPath('layouts'));
    layouts.push(...layoutDefaults);
}

// Checks which of the defaults are already installed and marks them as checked
async function checkInstalled() {
    const currentDir = process.cwd().split('\\').splice(-1)[0];
    if(currentDir !== 'styles') {
        throw new Error("Please navigate to the styles directory to add features");
    }

    try {
        const abstractsInstalled = await getFilesInDir(path.join('./', 'abstracts'));
        abstracts = _.map(abstracts, (feature) => {
            if(abstractsInstalled.includes(feature.name)) feature.checked = true;
            return feature;
        });

        // const abstractFiles = await fs.readdirSync(path.join('./', '/abstracts'));
        // for(let i = 0; i < abstractFiles.length; i++) {
        //     let name = abstractFiles[i].substr(1, abstractFiles[i].length - 6); // strip _ and .scss
        //     name = name[0].toUpperCase() + name.slice(1);
        //     const index = abstracts.findIndex(a => a.name == name);
        //     if(index !== -1) {
        //         abstracts[index].checked = true
        //     }
        // }
    } catch(e) {}
   
    try {
        const componentFiles = await fs.readdirSync(path.join('./', '/components'));
        for(let i = 0; i < componentFiles.length; i++) {
            let name = componentFiles[i].substr(1, componentFiles[i].length - 6); // strip _ and .scss
            name = name[0].toUpperCase() + name.slice(1);
            const index = components.findIndex(a => a.name == name);
            if(index !== -1) {
                components[index].checked = true
            }
        }
    } catch(e) {}
    
    try {
        const layoutFiles = await fs.readdirSync(path.join('./', '/layouts'));
        for(let i = 0; i < layoutFiles.length; i++) {
            let name = layoutFiles[i].substr(1, layoutFiles[i].length - 6); // strip _ and .scss
            name = name[0].toUpperCase() + name.slice(1);
            const index = layouts.findIndex(a => a.name == name);
            if(index !== -1) {
                layouts[index].checked = true
            }
        }
    } catch(e) {}
}

// Init a new styles directory
async function init() {
    const questions = [
        {
            type: 'fuzzypath',
            name: 'path',
            rootPath: './',
            message: chalk.cyan('Select path to install styles folder'),
            itemType: 'directory',
            default: './',
            depthLimit: 5,
            excludePath: nodePath => nodePath.startsWith('node_modules'),
            excludeFilter: nodePath => nodePath == '.',
        },
        {
            type: 'checkbox',
            message: chalk.cyan('Select features:'),
            name: 'features',
            choices: [
                new inquirer.Separator(chalk.green('Abstracts')),
                ...abstracts,
                new inquirer.Separator(chalk.green('Components')),
                ...components,
                new inquirer.Separator(chalk.green('Layout')),
                ...layouts
            ]
        }
    ]
    
    const answers = await inquirer.prompt(questions);

    stylesPath = path.join('./', answers.path + '/styles');

    await mkDir(stylesPath);
    await mkDir(path.join(stylesPath, '/base'));
    await copyDefault('base', 'base');
    await copyDefault('base', 'typography');
    await copyDefault('base', 'variables');
    
    abstracts = abstracts.filter((func) => answers.features.includes(func.name));
    if(abstracts.length) await mkDir(path.join(stylesPath, '/abstracts'));
    for(let i = 0; i < abstracts.length; i++) {
        if(!abstracts[i])
        await copyDefault('abstracts', abstracts[i].name.toLowerCase());
    }

    components = components.filter((func) => answers.features.includes(func.name));
    if(components.length) await mkDir(path.join(stylesPath, '/components'));
    for(let i = 0; i < components.length; i++) {
        await copyDefault('components', components[i].name.toLowerCase());
    }

    layouts = layouts.filter((func) => answers.features.includes(func.name));
    if(layouts.length) await mkDir(path.join(stylesPath, '/layouts'));
    for(let i = 0; i < layouts.length; i++) {
        await copyDefault('layouts', layouts[i].name.toLowerCase());
    }

    let str = '';

    for(let i = 0; i < abstracts.length; i++) {
        str += `@import "abstracts/${abstracts[i].name.toLowerCase()}";\n`;
    }
    for(let i = 0; i < components.length; i++) {
        str += `@import "components/${components[i].name.toLowerCase()}";\n`;
    }
    for(let i = 0; i < layouts.length; i++) {
        str += `@import "layouts/${layouts[i].name.toLowerCase()}";\n`;
    }

    await fs.writeFileSync(path.join(stylesPath, 'main.scss'), str);

    console.log(`${chalk.bold.green("Success!")} To use, ${chalk.yellow('@import')} ${chalk.blue('styles/main.scss')}`);
}

// Add features to an existing styles directory
async function add() {
    await checkInstalled();

    const questions = [
        {
            type: 'checkbox',
            message: chalk.cyan('Select features:'),
            name: 'features',
            choices: [
                new inquirer.Separator(chalk.green('Abstracts')),
                ...abstracts,
                new inquirer.Separator(chalk.green('Components')),
                ...components,
                new inquirer.Separator(chalk.green('Layout')),
                ...layouts
            ]
        }
    ]

    const answers = await inquirer.prompt(questions);

    abstracts = abstracts.filter((func) => answers.features.includes(func.name) || func.checked);

}

// Returns file name of sass files in dir
// Removes _ and .scss pre/postfixes and capitalizes first letter
async function getFilesInDir(path) {
    const files = await fs.readdirSync(path);
    let names = [];
    for(let i = 0; i < files.length; i++) {
        let name = files[i].substr(1, files[i].length - 6); // strip _ and .scss
        name = name[0].toUpperCase() + name.slice(1);
        names.push(name);
    }
    return names;
}

function getDefaultsPath(addPath) {
    return path.join(__dirname, '../defaults', addPath);
}

// Make new directory if it doesn't already exist
async function mkDir(path) {
    try {
        await fs.mkdirSync(path);
    } catch(e) {}
}

// Copy a file from defaults
async function copyDefault(dir, file) {
    await fs.copyFileSync(path.join(__dirname, '/defaults/', dir, '_' + file +'.scss'), 
        path.join(stylesPath,  dir, '_' + file +'.scss'));
}

async function main() {
    try {
        await initDefaults();
        var myArgs = process.argv.slice(2);
        switch (myArgs[0]) {
            case 'add':
                await add();
                break;
            default:
                await init();
                break;
         }
    } catch(e) {
        console.log(`${chalk.red("Error!")} ${e.message}`);
    }
    
}

main();