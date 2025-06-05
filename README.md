# P2P Chat Application

## Installation & Start

To start the P2P chat application, you first need to install the `dweb` command line tool:

```bash
cargo install --locked dweb-cli
```

For detailed installation instructions, please visit the [dweb repository](https://codeberg.org/happybeing/dweb).

After installation, you can start the application with:

```bash
dweb open a447871043968be2be1628584026cad30b824009a30eab43db3ee6dd8c0990051c27160cc8d1662da763d57c41c091f6
```

## Features

The P2P chat application enables direct peer-to-peer communication between users via WebRTC. Here are the main features:

### Account Management
- **Account Package**: All user settings are stored in an encrypted account package
- **Profile Picture**: Support for custom profile pictures via datamap addresses
- **Themes**: Customizable themes with background image support
- **Multilingual**: Support for multiple languages (English, German, French, Spanish, Bulgarian, Japanese, Korean, Chinese)

### Communication
- **WebRTC P2P**: Direct encrypted connections between users
- **Automatic Connection**: Intelligent handshake system for reliable peer connections
- **File Transfer**: Support for file exchange between users

### User Interface
- **Friends List**: Clear contact management
- **Chat Window**: Real-time message exchange with emoji support
- **Connection Status**: Real-time connection status display

## Usage

### Getting Started
1. **Create Account**: 
   - You'll be prompted to create an account on first launch
   - Enter a username
   - Optionally set a profile picture and theme

2. **Add Friends**:
   - Click on "Add Friend"
   - Enter the friend's peer ID
   - Set a display name

### Chat
1. **Start Chat**:
   - Select a friend from the list
   - Chat window opens automatically
   - Connection establishes automatically

2. **Send Messages**:
   - Enter text in the input field
   - Press Enter or click send
   - Files can be sent via attachment button

### Settings
1. **Customize Profile**:
   - Change profile picture via datamap address
   - Select and customize theme
   - Change interface language

2. **Notifications**:
   - Unread messages are displayed in the friends list

## Technical Details

The application uses the following technologies:
- **Svelte**: Frontend framework
- **WebRTC**: Peer-to-peer communication
- **Autonomi Network**: Decentralized backend

## Security

- All connections are end-to-end encrypted via WebRTC
- Account packages are stored encrypted on the autonomi network
- No central data storage
- No central server for communication

## Troubleshooting

### Connection Issues
- Check your internet connection
- Ensure the peer ID is correct
- Wait for automatic reconnect (60-second interval)

### File Transfer
- Maximum file size: 50MB
- If problems occur: Try sending the file again
- Supported file types: All

## Contributing

Suggestions for improvements and bug reports are welcome! Please use the Issues function in the repository.
