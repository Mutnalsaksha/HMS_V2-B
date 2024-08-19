//hms website backend
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const moment = require('moment-timezone');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb+srv://saksha:1234@cluster0.xnvkwgq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useUnifiedTopology: true, useNewUrlParser: true});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});
 

// Define MongoDB schema and model
const bookserviceSchema = new mongoose.Schema({
  // date: {type: String, default: () => new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })  },
  date: { type: String, required: true},
  name: { type: String, required: true, minlength:3, maxlength:30},
  phoneNumber: {type: String, required: true,  match: /^[0-9]{10}$/ },
  email: { type: String, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  service:  {type: String, required: true},
  message: { type: String, minlength: 0, maxlength: 500,},
  requestId: { type: String, required: true },
  requestDate: { type: Date, required: true },
  serviceType: { type: String, required: true },
  assignedTo: String,
  startDate: { type: Date },
  endDate: { type: Date },
  totalDays: Number,
  severity: String,
  status: String,
},{
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

const BookService = mongoose.model('BookService', bookserviceSchema);

//Use cors middleware
app.use(cors());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS middleware to allow cross-origin requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Middleware to set Content-Type for JavaScript files
app.use(express.static('public', { 
  setHeaders: (res, path, stat) => {
      if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
      }
  }
}));

// Login endpoint
// Define user schema
const userSchema = new mongoose.Schema({
  Username: String,
  Usertype: String,
  MobileNumber: String,
  EmailAddress: String,
  Password: String,
  Name: String,
  Address: String,
  Bio: String
});

const User = mongoose.model('User', userSchema);

app.use(cors());
app.use(bodyParser.json());

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ EmailAddress :email });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    if (user.Password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Authentication successful
    res.json({ message: 'Login successful', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// API route to fetch user profile by email
app.get('/api/profile', async (req, res) => {
  const email = req.query.email;
  try {
    const user = await User.findOne({ EmailAddress: email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// API route to update user profile
app.put('/api/profile', async (req, res) => {
  const { email, name, username, phone, address, bio } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { EmailAddress: email },
      { Name: name, Username: username, MobileNumber: phone, Address: address, Bio: bio },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});


app.get('/users/assigned', async (req, res) => {
  try {
    const users = await User.find({}, 'Username Usertype'); // Fetch only the Username field
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence_value: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

const getNextSequenceValue = async (sequenceName) => {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.sequence_value;
};

// Route to handle form submission
app.post('/addbookservice/submit', async (req, res) => {
  try {
    const { name, phoneNumber, email, service, message } = req.body;

    // Get current date and time in Indian timezone
    const currentDate = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

      // Count the documents in the BookService collection to generate a sequential ID
      const sequenceValue = await getNextSequenceValue('requestId');
      const formattedRequestId = `SR-${String((sequenceValue) + 1).padStart(2, '0')}`;

    const newBooking = new BookService({
      date: currentDate, 
      name: name,
      phoneNumber: phoneNumber,
      email: email,
      service: service,
      message: message,
      requestId: formattedRequestId,
      requestDate: currentDate,
      serviceType: service,
      status: 'New'
    });

    const savedContact = await newBooking.save();

    res.status(201).json(savedContact);
  } catch (error) {
    //console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/displaydata', async (req, res) => {
  try {
    const displayData = await BookService.find(); // Fetch all bookings

    // Format data before sending to frontend (if needed)
    const formattedData = displayData.map((item, index) => ({
      ...item.toObject(),
    
      // Format requestDate using moment.js
      requestDate: moment(item.requestDate).format('YYYY-MM-DD HH:mm:ss'),
      
    }));

    res.json(formattedData); // Send the formatted data as JSON response
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle errors
  }
});


// Endpoint to get data by requestId
app.get('/request/:id', async (req, res) => {
  try {
    const request = await BookService.findOne({ requestId: req.params.id });
    if (!request) {
      return res.status(404).send('Request not found');
    }
    res.send(request);
  } catch (error) {
    res.status(500).send(error);
  }
});


// Endpoint to update data by requestId
app.put('/request/:id', async (req, res) => {
  try {
    const request = await BookService.findOneAndUpdate(
      { requestId: req.params.id },
      req.body,
      { new: true }
    );
    if (!request) {
      return res.status(404).send('Request not found');
    }
    res.send(request);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Helper method to format date
function formatDate(date) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  return date.toLocaleString('en-IN', options).replace(/\//g, '-');
}


// Route to fetch and display ticket details
app.get('/getTicketDetails/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = await TicketDetails.findOne({ ticketId: ticketId });

    // Check if ticket details exist
    if (ticket) {
      res.json(ticket);
    } else {
      res.status(404).send('Ticket not found');
    }
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

// Add this route in your backend (app.js or index.js)
app.get('/api/bookservice/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await BookService.findById(bookingId, 'date service');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Simple route for the root path
app.get('/', (req, res) => {
  res.send('Welcome to your server!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});