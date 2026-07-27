const { getPool, sql } = require('./config/db');

async function seedShowtimes() {
    try {
        const pool = await getPool();
        
        // Movie IDs from 1 to 8, Room IDs from 1 to 5
        const movies = [1, 2, 3, 4, 5, 6, 7, 8];
        const rooms = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        
        const now = new Date();
        const showtimesToInsert = [];
        
        // Generate for today and next 6 days
        for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
            const date = new Date(now);
            date.setDate(date.getDate() + dayOffset);
            
            // Generate some timeslots: 10:00, 13:00, 16:00, 19:00, 22:00
            const hours = [10, 13, 16, 19, 22];
            
            for (const hour of hours) {
                // Randomly select 3 movies for this timeslot across different rooms
                const shuffledMovies = movies.sort(() => 0.5 - Math.random()).slice(0, 3);
                
                for (let i = 0; i < shuffledMovies.length; i++) {
                    const movieId = shuffledMovies[i];
                    const roomId = rooms[Math.floor(Math.random() * rooms.length)];
                    
                    const startTime = new Date(date);
                    startTime.setHours(hour, 0, 0, 0);
                    
                    const endTime = new Date(startTime);
                    endTime.setHours(hour + 2, 30, 0, 0); // Assuming 2.5 hours runtime
                    
                    showtimesToInsert.push({
                        MovieID: movieId,
                        RoomID: roomId,
                        StartTime: startTime,
                        EndTime: endTime,
                        BasePrice: 85000,
                        Price: 85000,
                        Status: 'active'
                    });
                }
            }
        }
        
        console.log(`Generating ${showtimesToInsert.length} showtimes...`);
        
        let inserted = 0;
        for (const st of showtimesToInsert) {
            await pool.request()
                .input('MovieID', sql.Int, st.MovieID)
                .input('RoomID', sql.Int, st.RoomID)
                .input('StartTime', sql.DateTime, st.StartTime)
                .input('EndTime', sql.DateTime, st.EndTime)
                .input('BasePrice', sql.Decimal(10, 2), st.BasePrice)
                .input('Status', sql.NVarChar(20), st.Status)
                .query(`
                    INSERT INTO Showtimes (MovieID, RoomID, StartTime, EndTime, BasePrice, Status)
                    VALUES (@MovieID, @RoomID, @StartTime, @EndTime, @BasePrice, @Status)
                `);
            inserted++;
            if (inserted % 10 === 0) console.log(`Inserted ${inserted}/${showtimesToInsert.length}...`);
        }
        
        console.log('Seed showtimes completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding showtimes:', err);
        process.exit(1);
    }
}

seedShowtimes();
