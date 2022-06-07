# Minimal Anchor

## Description

A thin wrapper around the Anchor library. The library provides a thin wrapper around the Anchor library so that some methods could be used without requiring a Solana identity file.

## Supported Functions

The following functions are supported:

|Name|Description|
|-------|-------|
|fetchIDL|Fetches an idl from the blockchain|
|getProgramAccounts|The method is a replacement for getting accounts from the Program class of Anchor. This method returns the accounts directly without requiring an id.json file|
|getCoder|Get a coder which can be used to parse accounts, instructions or events|

## Getting Started

The library can be installed from npm with the following commands:

NPM - `npm install minimal-anchor`

Yarn - `yarn add minimal-anchor`
