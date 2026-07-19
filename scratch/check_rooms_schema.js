const fs = require('fs');
const sql = fs.readFileSync('config/CinemaManagement.sql', 'utf8');

const tableStart = sql.indexOf('CREATE TABLE Rooms (');
if (tableStart > -1) {
    console.log(sql.substring(tableStart, tableStart + 1000));
} else {
    console.log('Not found CREATE TABLE Rooms');
}
