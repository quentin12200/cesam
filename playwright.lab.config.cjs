const {defineConfig,devices}=require("@playwright/test");
module.exports=defineConfig({
 testDir:"./tests/browser-lab",fullyParallel:false,retries:0,workers:1,timeout:60000,expect:{timeout:10000},
 use:{baseURL:"http://127.0.0.1:4317",trace:"retain-on-failure",screenshot:"only-on-failure",serviceWorkers:"block"},
 projects:[{name:"ordinateur",use:{...devices["Desktop Chrome"]}},{name:"iphone",use:{...devices["iPhone 13"]}}],
 webServer:{command:"node scripts/lab-test-server.mjs",url:"http://127.0.0.1:4317/lab",reuseExistingServer:false,timeout:180000},
 reporter:[["list"],["html",{open:"never"}]]
});
