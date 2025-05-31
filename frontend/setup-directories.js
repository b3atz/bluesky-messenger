const fs = require('fs');
const path = require('path');

// Define the directory structure
const directories = [
    'app',
    'app/messages',
    'app/messages/[conversationId]',
    'app/settings',
    'app/settings/privacy',
    'app/settings/account',
    'app/privacy',
    'components',
    'components/auth',
    'components/layout',
    'components/messages',
    'components/privacy',
    'components/settings',
    'components/shared',
    'contexts',
    'hooks',
    'utils',
    'public',
    'backend',
    'backend/routes'
];

// Create the directories
directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dir}`);
    } else {
        console.log(`Directory already exists: ${dir}`);
    }
});

// Create a placeholder for the Bluesky logo
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <path d="M48 96C74.5097 96 96 74.5097 96 48C96 21.4903 74.5097 0 48 0C21.4903 0 0 21.4903 0 48C0 74.5097 21.4903 96 48 96Z" fill="#0560FF"/>
  <path d="M28 48C28 36.9543 36.9543 28 48 28C59.0457 28 68 36.9543 68 48C68 59.0457 59.0457 68 48 68C36.9543 68 28 59.0457 28 48Z" fill="white"/>
</svg>`;

const logoPath = path.join(__dirname, 'public', 'bluesky-logo.svg');
if (!fs.existsSync(logoPath)) {
    fs.writeFileSync(logoPath, logoSvg);
    console.log('Created Bluesky logo placeholder');
}

console.log('\nDirectory structure setup complete!');
console.log('\nNext steps:');
console.log('1. Run: npm install');
console.log('2. Copy component files to their appropriate directories');
console.log('3. Start the development server: npm run dev');