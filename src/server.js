const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require("cors");
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const User = require('./schema/user');
const blogs = require('./schema/blogsData');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
const Version = require('./schema/versionHistory');
const crypto = require('crypto');
const secret = crypto.randomBytes(64).toString('hex');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || secret;
app.use(express.json());

const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

const StudentDocuments = require('./schema/StudentDocuments');

const fs = require('fs');
const path = require('path');

const uploadsPath = path.join(__dirname, 'uploads'); // ✅ inside src/uploads


const multer = require('multer');
app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
});

const storage = multer.memoryStorage();


cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log('✅ uploads folder created at:', uploadsPath);
} else {
    console.log('✅ uploads folder already exists at:', uploadsPath);
}


// Multer Setup
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, uploadsPath); 
//     },
//     filename: function (req, file, cb) {
//         const uniqueName = Date.now() + '-' + file.originalname;
//         cb(null, uniqueName);
//     },
// });

const upload = multer({ storage });

// Helper to upload a buffer to cloudinary
const uploadToCloudinary = (fileBuffer, originalname, folder) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                {
                    folder,
                    resource_type: 'auto',
                    public_id: originalname.split('.')[0],
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            )
            .end(fileBuffer);
    });
};

app.post('/upload', upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'tenth', maxCount: 1 },
    { name: 'twelfth', maxCount: 1 },
    { name: 'degree', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
]), async (req, res) => {
    try {
        const documentData = {};
        for (const fieldName in req.files) {
            const file = req.files[fieldName][0];
            const result = await uploadToCloudinary(file.buffer, file.originalname, 'student-docs');

            documentData[fieldName] = {
                resourceType: result.resource_type,
                createdAt: result.created_at,
                fileType: result.format,
                path: result.url,
                fileUrl: result.secure_url,
                displayName: file.originalname,
            };
        }

        // Optional: Add studentId if you're tracking user
        const savedDocument = new StudentDocuments({
            ...documentData,
            studentId: req.body.studentId || 'unknown',
        });

        await savedDocument.save();
        res.status(200).json({ message: 'All documents uploaded', data: savedDocument });
    } catch (err) {
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
});


app.get('/files', async (req, res) => {

    try {
        const files = await StudentDocuments.find();
        if (!files || files.length === 0) {
            return res.status(404).json({ message: 'No files found' });
        }
        res.status(200).json(files);
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            error: err.message,
            stack: err.stack,
        });
    }
});

app.post('/register', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const userName = req.body.email;
        let userExist = await User.findOne({ user_name: userName });
        if (!userExist) {
            const newUser = new User({
                user_name: req.body.email,
                password: req.body.password
            });
            const token = jwt.sign({ password: newUser.password, user_Name: newUser.user_name }, JWT_SECRET, { expiresIn: '1h' });
            newUser.access_token = token.split('.')[2];
            let userData = await newUser.save();
            if (userData && typeof (userData) === 'object' && userData._id) {
                res.send(
                    {
                        status: 'Success',
                        message: 'User created successfully.',
                        result: userData
                    }
                )
            } else {
                res.send(
                    {
                        status: 'Failed',
                        message: 'Something went wrong.'
                    }
                );
            }
        } else {
            res.send({
                status: 'Failed',
                message: 'User already exist'
            });
        }
    } catch (err) {
        res.send({ status: 'Failed' });
    }
});

app.post('/versioning', async (req, res) => {
    const version = req.body.version;
    const dashboard = req.body.dashboard;
    if (!version) {
        return res.status(400).json({ message: 'Version is required' });
    }
    try {

        const newVersion = new Version({
            version: version,
            dashboard: dashboard
        })
        let versionData = await newVersion.save();

        if (versionData && typeof (versionData) === 'object' && versionData._id) {
            res.send(
                {
                    status: 'Success',
                    message: 'User created successfully.',
                    result: versionData
                }
            )
        } else {
            res.send(
                {
                    status: 'Success',
                    message: 'User created successfully.',
                }
            )
        }
    }

    catch (err) {
        res.send({ status: 'Failed' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
});

app.post('/login', async (req, res) => {

    try {
        const userName = req.body.email;
        let userExist = await User.findOne({ user_name: userName })
        if (userExist) {
            res.send({
                status: 'Success',
                message: 'Login Successfully',
                result: userExist
            })
        } else {
            res.send({
                status: 'Failed',
                message: 'Invalid username or password'
            })
        }
    } catch (err) {
        res.send({ status: 'Failed' })
    }
})

app.put('/updateUser', async (req, res) => {

    try {
        const userId = req.body.id;
        const updateDetails = req.body.updateDetails;
        let userExist = await User.findOne({ _id: userId });
        if (userExist) {
            const userUpdate = await User.updateOne({ _id: userId }, {
                $set: {
                    first_name: updateDetails.firstName,
                    middle_name: updateDetails.middleName,
                    last_name: updateDetails.lastName,
                    age: updateDetails.age,
                    gender: updateDetails.gender,
                    dob: updateDetails.dob
                }
            })

            if (userUpdate) {
                res.send({
                    statusCode: 200,
                    message: 'User updated successfully.',
                })
            } else {
                res.send({
                    status: 'Failed',
                    message: 'something went wrong.'
                })
            }
        }
    } catch (err) {
        res.send({ status: 500 });
    }
});

app.get('/getUserList', async (req, res) => {
    try {
        let userData = await User.find().exec();
        if (userData) {
            res.send({
                statusCode: 200,
                result: userData,
                message: 'User list fetched successfully'
            });
        }
    } catch (err) {
        res.send({ status: 500 })
    }
});

app.get('/getBlogData', async (req, res) => {

    try {
        let blogData = await blogs.find().exec();
        if (blogData) {
            res.send({
                statusCode: 200,
                result: blogData,
                message: 'Blog list fetched successfully'
            });
        }
    } catch (err) {
        res.send({ status: 500 })
    }
});

app.post('/setBlogData', async (req, res) => {
    try {
        const newBlog = new blogs({
            title: req.body.title,
            description: req.body.description,
            image: req.body.image,
            location: req.body.location,
            date: req.body.date
        })
        let blogData = await newBlog.save();
        if (blogData && typeof (blogData) === 'object' && blogData._id) {
            res.send({
                status: 'Success',
                message: 'Blog created successfully.',
                result: blogData
            })
        } else {
            res.send({
                status: 'Failed',
                message: 'Blog creation failed.',
            })
        }
    } catch (err) {
        res.send({ status: 500 })
    }
});

app.get('/:userId', async (req, res) => {
    try {
        const userId = req.params.userId
        let userData = await User.findOne({ _id: userId }).exec();
        if (userData) {
            res.send({
                statusCode: 200,
                result: userData,
                message: 'User data fetched successfully'
            });
        } else {
            res.send({
                statusCode: 404,
                message: 'User not found'
            })
        }
    } catch (err) {
        res.send({ status: 500 })
    }
});

app.post('/uploadImage', async (req, res) => {
    console.log('req', req);
    try {

    } catch (error) {

    }
})

app.listen(3001, () => {
    console.log('Server is running on port 3001');
});


// mongo DB Connection

mongoose.Promise = global.Promise;

const mongoUrl = process.env.REACT_APP_MONGODB;
console.log(mongoUrl);
mongoose.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true,
    tls: true
}).then(() => {
    console.log("Successfully connected to the database --- " + mongoUrl);
}).catch(err => {
    console.log('Could not connect to the database. Exiting now...', err);
    process.exit();
});
