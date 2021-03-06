"use strict";
/*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Chaincode Invoke
This code is based on code written by the Hyperledger Fabric community.
  Original code can be found here: https://gerrit.hyperledger.org/r/#/c/14395/4/fabcar/enrollAdmin.js
 */

var Fabric_Client = require("fabric-client");
var Fabric_CA_Client = require("fabric-ca-client");

var path = require("path");
var util = require("util");
var os = require("os");
var defaultConfig = require("./src/config");
//
var fabric_client = new Fabric_Client();
var fabric_ca_client = null;
var admin_user = null;
var member_user = null;
var store_path = path.join(__dirname, "hfc-key-store");
console.log(" Store path:" + store_path);
const username = process.argv[2] || "admin";
const password = process.argv[3] || "adminpw";
// create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
Fabric_Client.newDefaultKeyValueStore({
  path: store_path
})
  .then(state_store => {
    // assign the store to the fabric client
    fabric_client.setStateStore(state_store);
    var crypto_suite = Fabric_Client.newCryptoSuite();
    // use the same location for the state store (where the users' certificate are kept)
    // and the crypto store (where the users' keys are kept)
    var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
    crypto_suite.setCryptoKeyStore(crypto_store);
    fabric_client.setCryptoSuite(crypto_suite);
    var tlsOptions = {
      trustedRoots: [],
      verify: false
    };
    // be sure to change the http to https when the CA is running TLS enabled
    fabric_ca_client = new Fabric_CA_Client(
      (defaultConfig.tlsEnabled ? "https://" : "http://") +
        defaultConfig.caServer,
      tlsOptions,
      null,
      crypto_suite
    );

    // first check to see if the admin is already enrolled
    return fabric_client.getUserContext(username, true);
  })
  .then(user_from_store => {
    if (user_from_store && user_from_store.isEnrolled()) {
      console.log("Successfully loaded " + username + " from persistence");
      admin_user = user_from_store;
      return null;
    } else {
      // need to enroll it with CA server
      return fabric_ca_client
        .enroll({
          enrollmentID: username,
          enrollmentSecret: password,
          attr_reqs: [{ name: "role", optional: true }]
        })
        .then(enrollment => {
          console.log('Successfully enrolled admin user "' + username + '"');
          return fabric_client.createUser({
            username: username,
            mspid: "Org1MSP",
            cryptoContent: {
              privateKeyPEM: enrollment.key.toBytes(),
              signedCertPEM: enrollment.certificate
            }
          });
        })
        .then(user => {
          admin_user = user;
          return fabric_client.setUserContext(admin_user);
        })
        .catch(err => {
          console.error(
            "Failed to enroll and persist admin. Error: " + err.stack
              ? err.stack
              : err
          );
          throw new Error("Failed to enroll " + username);
        });
    }
  })
  .then(() => {
    console.log(
      "Assigned the " +
        username +
        " user to the fabric client ::" +
        admin_user.toString()
    );
  })
  .catch(err => {
    console.error("Failed to enroll " + username + ": " + err);
  });
