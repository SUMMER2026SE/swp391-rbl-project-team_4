const { getPool } = require('../config/db');

(async () => {
  try {
    const pool = await getPool();
    console.log("Connected to DB, performing cascaded deletion of 5 movies (revised)...");

    const result = await pool.request().query(`
      DECLARE @MovieTitles TABLE (Title NVARCHAR(255));
      INSERT INTO @MovieTitles VALUES 
        (N'Midnight Run'), 
        (N'The Odyssey'), 
        (N'Golden Age'), 
        (N'The Last Echo'), 
        (N'Neon Horizon');

      -- 1. Delete from Booking_FnB (linked to Bookings which is linked to Showtimes)
      IF OBJECT_ID('Booking_FnB', 'U') IS NOT NULL
      BEGIN
        DELETE bf FROM Booking_FnB bf
        JOIN Bookings b ON bf.BookingID = b.BookingID
        JOIN Showtimes s ON b.ShowtimeID = s.ShowtimeID
        JOIN Movies m ON s.MovieID = m.MovieID
        WHERE m.Title IN (SELECT Title FROM @MovieTitles);
      END

      -- 2. Delete from BookingTickets (linked to Bookings which is linked to Showtimes)
      IF OBJECT_ID('BookingTickets', 'U') IS NOT NULL
      BEGIN
        DELETE bt FROM BookingTickets bt
        JOIN Bookings b ON bt.BookingID = b.BookingID
        JOIN Showtimes s ON b.ShowtimeID = s.ShowtimeID
        JOIN Movies m ON s.MovieID = m.MovieID
        WHERE m.Title IN (SELECT Title FROM @MovieTitles);
      END

      -- 3. Delete from Bookings (linked to Showtimes)
      IF OBJECT_ID('Bookings', 'U') IS NOT NULL
      BEGIN
        DELETE b FROM Bookings b
        JOIN Showtimes s ON b.ShowtimeID = s.ShowtimeID
        JOIN Movies m ON s.MovieID = m.MovieID
        WHERE m.Title IN (SELECT Title FROM @MovieTitles);
      END

      -- 4. Delete from Ticket_FnB (linked to Tickets which is linked to Showtimes)
      IF OBJECT_ID('Ticket_FnB', 'U') IS NOT NULL
      BEGIN
        DELETE tf FROM Ticket_FnB tf
        JOIN Tickets t ON tf.TicketID = t.TicketID
        JOIN Showtimes s ON t.ShowtimeID = s.ShowtimeID
        JOIN Movies m ON s.MovieID = m.MovieID
        WHERE m.Title IN (SELECT Title FROM @MovieTitles);
      END

      -- 5. Delete from Tickets (linked to Showtimes)
      IF OBJECT_ID('Tickets', 'U') IS NOT NULL
      BEGIN
        DELETE t FROM Tickets t
        JOIN Showtimes s ON t.ShowtimeID = s.ShowtimeID
        JOIN Movies m ON s.MovieID = m.MovieID
        WHERE m.Title IN (SELECT Title FROM @MovieTitles);
      END

      -- 6. Delete from Showtimes
      IF OBJECT_ID('Showtimes', 'U') IS NOT NULL
      BEGIN
        DELETE s FROM Showtimes s
        JOIN Movies m ON s.MovieID = m.MovieID
        WHERE m.Title IN (SELECT Title FROM @MovieTitles);
      END

      -- 7. Delete from Movie_Genres
      IF OBJECT_ID('Movie_Genres', 'U') IS NOT NULL
      BEGIN
        DELETE mg FROM Movie_Genres mg
        JOIN Movies m ON mg.MovieID = m.MovieID
        WHERE m.Title IN (SELECT Title FROM @MovieTitles);
      END

      -- 8. Delete from Reviews
      IF OBJECT_ID('Reviews', 'U') IS NOT NULL
      BEGIN
        DELETE r FROM Reviews r
        JOIN Movies m ON r.MovieID = m.MovieID
        WHERE m.Title IN (SELECT Title FROM @MovieTitles);
      END

      -- 9. Delete from Movies
      DELETE FROM Movies WHERE Title IN (SELECT Title FROM @MovieTitles);
      
      SELECT @@ROWCOUNT AS DeletedCount;
    `);

    console.log("Successfully deleted requested movies and all their references from the database!");
  } catch (err) {
    console.error("Failed to delete movies:", err);
  } finally {
    process.exit(0);
  }
})();
