const { ethers } = require("hardhat");

async function main() {
    // 1️⃣ Obtener cuentas de prueba
    const accounts = await ethers.getSigners();
    console.log("Cuenta de deployer:", accounts[0].address);

    // 2️⃣ Conectar con el contrato PYUSDFactory
    const factory = await ethers.getContractAt(
        "PYUSDFactory", 
        "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e" // dirección de tu contrato
    );

    // 3️⃣ Crear un TrustCircle de prueba con pocos PYUSD
    const futureTimestamp = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 días
    await factory.createPYUSDTrustCircle(
        accounts[0].address,  // tu cuenta
        futureTimestamp,       // expiración
        1000,                  // 10% copay
        10 * 10**6,            // 10 PYUSD por reclamo
        50 * 10**6,            // 50 PYUSD cobertura total
        ethers.ZeroAddress     // fallback
    );
    console.log("TrustCircle creado!");

    // 4️⃣ Consultar cuántos TrustCircles existen
    const count = await factory.getPYUSDCirclesCount();
    console.log("Total de TrustCircles:", count.toString());

    // 5️⃣ Ver la información del primer TrustCircle
    const circle = await factory.allPYUSDCircles(0);
    console.log("Primer TrustCircle:", circle);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
