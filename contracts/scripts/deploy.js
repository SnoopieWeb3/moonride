const fs = require("fs");

async function main() {

    const [deployer] = await ethers.getSigners();

    console.log(
        "Starting Deployments from account:",
        deployer.address
    );

    console.log(
        "Deploying Vault"
    );

    const vault = await ethers.getContractFactory("Vault");

    const vaultService = await vault.deploy();

    const vaultAddress = vaultService.address;

    console.log(
        "Successfully Deployed Vault",
        vaultAddress
    );

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
});