const port = 4000;

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

app.use(express.json());
app.use(cors());

// you can copy and use 5.5 connection string but i will copy 2.2.2. 

// Database connection wit mongodb

mongoose.connect("mongodb://mako:benzema123@cluster0-shard-00-00.grzfa.mongodb.net:27017,cluster0-shard-00-01.grzfa.mongodb.net:27017,cluster0-shard-00-02.grzfa.mongodb.net:27017/mako?ssl=true&replicaSet=atlas-fva7ra-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0")

// Api creation
app.get("/", (req, res)=>{
    res.send("Express App is running ")
})

// image storage engine 
const storage = multer.diskStorage({
    destination: './upload/images',
    filename:(req, file, cb) =>{
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage})
// creating upload endpoint for images
app.use('/images', express.static('upload/images'))
app.post("/upload", upload.single('product'), (req,res)=>{
    res.json({
        success:1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})

// schema for creating products
const Product = mongoose.model("product",{
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image:{
        type: String,
        required: true,
    },
    category:{
        type: String,
        required: true
    },
    new_price:{
        type: Number,
        required: true,
    },
    old_price:{
        type: Number,
        required: true,
    },
    date:{
        type: Date,
        default: Date.now,
    },
    available:{
        type: Boolean,
        default: true,
    },
})
// creating api for adding products
app.post('/addproduct', async(req,res)=>{
    let products = await Product.find({});
    let id;
    if(products.length > 0){
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id +1;
    } else {
        id = 1;
     }
    
    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("saved")
    res.json({
        success:true,
        name: req.body.name,
    })
    
})

// creating api for remove products
app.post('/removeproduct', async(req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success:true,
        name: req.body.name,
    })    
})


// creating api for all products
app.get('/allproducts', async (req,res)=>{
    let products = await Product.find({});
    console.log("All products fetched");
    res.send(products)    
})

// scheme user model
const User = mongoose.model('User',
    {
    name:{
        type: String,
    },
    email:{
        type: String,
        unique: true,
    },
    password:{
        type: String,
    },
    cartData:{
        type: Object
    },
    date: {
        type: Date,
        default: Date.now,
    }
})


// creating endpoints for registering the user
app.post('/signup', async(req,res)=>{
    let check = await User.findOne({email: req.body.email});
    if(check){
        return res.status(400).json({success: false, errors: 'Existing user found with same email'});
    }
    let cart = {};
    for (let i = 0; i < 300; i++){
        cart[i] = 0;
    }

    const user = new User(
        {
            name: req.body.username,
            email: req.body.email,
            password: req.body.password,
            cartData:cart,
        }
    )
    await user.save();

    const data = {
        user:{
            id: user.id

        }
    }
    const token = jwt.sign(data, 'secret_ecom');
    res.json({success: true, token})
})


// creating endpoints for user login
app.post('/login', async (req, res) =>{
    let user = await User.findOne({email:req.body.email});
    if(user) {
        const passMatch = req.body.password === user.password;
        if(passMatch){
            const data = {
                user: {
                    id: user.id
                }
            }
            const token= jwt.sign(data, 'secret_ecom');
            res.json({success: true, token});
        }else {
            res.json({success:false, errors: "wrong Password"})
        }
    }else {
        res.json({success:false, errors: "wrong Email address"})
    }
})

// creating endpoints for latestproducts
app.get('/newcollection', async(req,res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("newcollection fetched");
    res.send(newcollection);
})

// creating endpoint for popular products
app.get('/popularproducts', async (req, res)=>{
    let products= await Product.find({category: "men"});
    let popularproducts = products.slice(0, 4);
    console.log("popular products fetched");
    res.send(popularproducts);
})



// creating middlewear to fetch user
const fetchUser = async (req, res, next)=>{
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors: "please authenicate using valid login"});

    }else{
        try{
            const data = jwt.verify(token, "secret_ecom");
            req.user = data.user;
            next();
        }catch (error){
            res.status(401).send({errors: "please authenicate using valid token"});
        }
    }
}

// creating endpoints for adding products to cartData

app.post('/addtocart',fetchUser, async ( req, res)=>{
    let userData = await User.findOne({_id: req.user.id})
    userData.cartData[req.body.itemId] += 1;
    await User.findByIdAndUpdate({_id:req.user.id}, {cartData:userData.cartData});
    res.send("Added");
}) 

// creating endpoints for removing products to cartData
app.post('/removefromcart',fetchUser, async ( req, res)=>{
   console.log("Removed", req.body.itemId);    
   let userData = await User.findOne({_id: req.user.id})
   if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
    await User.findByIdAndUpdate(
    {_id:req.user.id}, 
    {cartData:userData.cartData});
    res.send("removed");
}) 

// creating endpoints  to get cart data
app.post('/getcart', fetchUser,async(req,res)=>{
    
})

app.listen(port, (error)=>{
    if(!error){
        console.log("server is running on port " + port);
    } else {
        console.log("Error:" + error);
        
    }
})