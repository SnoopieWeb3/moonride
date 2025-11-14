const { Wallet } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync");
const { vars } = require("hardhat/config");

require("dotenv").config();

module.exports = async function (hre) {

    console.log(`Running deploy script`);

    const wallet = new Wallet(process.env.PRIVATE_KEY);

    const deployer = new Deployer(hre, wallet);

    const artifact = await deployer.loadArtifact("Vault");

    const vaultContract = await deployer.deploy(artifact);

    console.log(
        `${artifact.contractName
        } was deployed to ${await vaultContract.getAddress()}`
    );

};