const express = require('express');
const Handlebars = require('handlebars');
const exphbs  = require('express-handlebars');
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const session = require('express-session');
//load model
const Contact = require('./models/contact');
const User = require('./models/user');
const Message = require('./models/message');
//load passports
require('./passport/passport-facebook');
require('./passport/passport-google');
//load database url
const keys = require('./config/keys');
const user = require('./models/user');
// load helpers
const {requireLogin,ensureGuest} = require('./helpers/auth');
const e = require('express');
const app = express();
//set global variables for user
app.use((req,res,next) => {
    res.locals.user = req.user || null;
    next();
});
//express static files
app.use(express.static('client'));
//passport middleware
app.use(cookieParser());
app.use(session({ 
    secret: 'keyboard cat',
    saveUninitialized:true,
    resave:true 
}));
app.use(passport.initialize());
app.use(passport.session());
//install body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
// set template engine for view
app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    handlebars: allowInsecurePrototypeAccess(Handlebars)
}));
app.set('view engine', 'handlebars');
//connect server to MongoDB
mongoose.connect(keys.MongoURI,{
    useNewUrlParser: true
}).then(() => {
    console.log('Connected to MongoDB..');
}).catch((err) => {
    console.log(err);
});
//handle route for facebook passport auth
app.get('/auth/facebook',
  passport.authenticate('facebook', {
      scope: 'email'
  }));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/profile');
  });
 //handle google auth routes 
 app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/profile');
  });
// create port
const port = 3000;

app.get('/',ensureGuest,(req,res) => {
    res.render('home');
});

app.get('/profile',requireLogin,(req,res) => {
    User.findById({_id:req.user._id})
    .then((user) => {
        res.render('profile',{
            user:user
        })
    }).catch((err) => {
        console.log(err);
    });
});

app.get('/logout',(req,res) => {
    req.logout();
    res.redirect('/');
})

app.get('/about',ensureGuest,(req,res) => {
    res.render('about');
});

app.get('/contact',ensureGuest,(req,res) => {
    res.render('contact');  
});

//handle POST route for contact
app.post('/contactus',ensureGuest,(req,res) => {
    console.log(req.body);
    const newContact = {
        name: req.body.name,
        email: req.body.email,
        message: req.body.message,
        date: new Date()
    }
    new Contact(newContact).save((err,contact) => {
        if (err) {
            throw err;
        }
        res.redirect('/success');
    });
});
app.get('/inbox',ensureGuest,(req,res) => {
    Contact.find({})
    .then((contacts) => {
        if (contacts) {
            res.render('contacts',{
                contacts:contacts
            });
        }else{
            res.render('empty');
        }
    }).catch((err) => {
        console.log(err);
    });
});
app.get('/success',ensureGuest,(req,res) => {
    res.render('success');
});
app.get('/users',requireLogin,(req,res) => {
    User.find({})
    .then((users) => {
        User.findOne({_id:req.user._id})
        .then((user) => {
            res.render('users', {
                users: users,
                user:user
            });
        }).catch((err) => {
            console.log(err);
        });
    }).catch((err) => {
        console.log(err);
    });
});
//start chat process
app.get('/startChat/:id',(req,res) => {
    Message.findOne({sender:req.params.id,receiver:req.user._id})
    .then((message) => {
        if (message) {
            message.receiverRead = true;
            message.senderRead = false;
            message.save((err,message) => {
                if (err) {
                    throw err;
                }
                res.redirect(`/chat/${message._id}`);
            })
        }else{
            Message.findOne({sender:req.user._id,receiver:req.params.id})
            .then((message) => {
                if (message) {
                    message.senderRead = true;
                    message.receiverRead = false;
                    message.date = new Date();
                    message.save((err,message) => {
                        if (err) {
                            throw err;
                        }
                        res.redirect(`/chat/${message._id}`);
                    })
                }else{
                    const newMessage = {
                        sender: req.user._id,
                        receiver: req.params.id,
                        senderRead: true,
                        receiverRead: false,
                        date: new Date()
                    }
                    new Message(newMessage).save((err,message) => {
                        if (err) {
                            throw err;
                        }
                        res.redirect(`/chat/${message._id}`);
                    })
                }
            }).catch((err) => {
                console.log(err);
            });
        }
    }).catch((err) => {
        console.log(err);
    });
})
app.get('/chat/:id',(req,res) => {
    Message.findById({_id:req.params.id})
    .populate('sender')
    .populate('receiver')
    .populate('chats.senderName')
    .populate('chats.receiverName')
    .then((message) => {
        res.render('chatRoom',{
            message:message
        })
    }).catch((err) => {
        console.log(err);
    });
})
app.listen(port,() => {
    console.log(`Server is running on port ${port}`);
});