const User = require('../models/user');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const Post = require('../models/post');
const {clearImage} = require('../util/file');
module.exports ={
    createUser({userInput},req) {
        const errors = [];
        if(!validator.isEmail(userInput.email)){
            errors.push({message:"Invalid E-mail"});
        }
        if(validator.isEmpty(userInput.password)|| 
        !validator.isLength(userInput.password,{min:5}))
        {
            errors.push({message:"Password too short"});
        }
        if(errors.length>0){
            const error = new Error('Invalid input!');
            error.data =errors;
            error.code=422;
            throw error;

        }
       return User.findOne({email:userInput.email}).then(user=>{
           if(user){
               const error = new Error('User exists already!');
               throw error;
           }
           return bcrypt.hash(userInput.password,12);
       }).then(hashedPassword=>{
           const user = new User({
               email: userInput.email,
               name: userInput.name,
               password:hashedPassword
           });
           return user.save();
       }).then(result =>{
           return {...result._doc,_id:result._id.toString()};
       }).catch(err =>{
           console.log(err);
       });  
    },
    login({email,password}) {
        let currentUser;
        return User.findOne({email:email}).then(user =>{ 
            if(!user){
                const error = new Error('User not found');
                error.code=401;
                throw error;
            }
            currentUser=user;
            return bcrypt.compare(password,user.password);
        }).then(isEqual =>{
            if(!isEqual){
                const error = new Error('Password is incorrect!');
                error.code=401;
                throw error;
            }
           const token = jwt.sign({
                userId:currentUser._id.toString(),
                email:currentUser.email
            },'secret',{expiresIn:'1h'});
            return {token:token,userId:currentUser._id.toString()};
        }).catch(err =>{
            console.log(err);
        });
    },
    createPost({ postInput },req){
        let currentUser;
        if(!req.isAuth){
            const error = new Error('Not Authenticated!');
            error.code = 401;
            throw error;
        }
        const errors = [];
        if(validator.isEmpty(postInput.title) || !validator.isLength(postInput.title,{min:5})){
            errors.push({message:"Title is invalid"});
        }
        if(validator.isEmpty(postInput.content) || !validator.isLength(postInput.content,{min:5})){
            errors.push({message:"Content is invalid"});
        }
        if(errors.length>0){
            const error = new Error('Invalid input!');
            error.data =errors;
            error.code=422;
            throw error;
      }
     return User.findById(req.userId).then(user =>{
          if(!user){
            const error = new Error('Invalid user!');
            error.data =errors;
            error.code=401;
            throw error;
          }
          currentUser = user;
          const post = new Post({
            title:postInput.title,
            content:postInput.content,
            imageUrl:postInput.imageUrl,
            creator:user
        });
        return post.save();
      }).then(post=>{
          currentUser.posts.push(post);
          currentUser.save();
        return {...post._doc,
            id:post._id.toString(),
            createdAt:post.createdAt.toISOString(),
            updatedAt:post.updatedAt.toISOString()
        }
      }).catch(err=>{
          console.log(err);
      });
    },
    posts({page},req){
        let total;
        if(!req.isAuth){
            const error = new Error('Not Authenticated!');
            error.code = 401;
            throw error;
        }
        if(!page){
            page = 1;
        }
        const perPage = 2;
        return Post.find().countDocuments().then(totalPosts =>{
            total=totalPosts;
            console.log(total);
            return Post.find().sort({createdAt:-1}).populate('creator')
            .skip((page-1)*perPage)
            .limit(perPage);
        }).then(post =>{
            return{posts:post.map(p =>{
                return {...p._doc,
                    _id:p._id.toString(),
                    createdAt:p.createdAt.toISOString(),
                    updatedAt:p.updatedAt.toISOString()}
            }),totalPosts:total};
        }).catch(err =>{
            console.log(err);
        })

    },async post({id},req){
        if(!req.isAuth){
            const error = new Error('Not Authenticated!');
            error.code = 401;
            throw error;
        }
        try {
            const post = await Post.findById(id).populate('creator');
            if (!post) {
                const error_1 = new Error('No post found!');
                error_1.code = 404;
                throw error_1;
            }
            return {
            ...post._doc,
                _id: post._id.toString(),
                createdAt: post.createdAt.toISOString(),
                updatedAt: post.updatedAt.toISOString()
            };
        }
        catch (err) {
            return console.log(err);
        }
    },
    async updatePost({id,postInput},req) {
        if(!req.isAuth){
            const error = new Error('Not Authenticated!');
            error.code = 401;
            throw error;
        }
        try {
            const post = await Post.findById(id).populate('creator');
            if (!post) {
                const error_1 = new Error('No post found!');
                error_1.code = 404;
                throw error_1;
            }
            if (post.creator._id.toString() !== req.userId.toString()) {
                const error_2 = new Error('Not authorized');
                error_2.code = 403;
                throw error_2;
            }
            const errors = [];
            if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, { min: 5 })) {
                errors.push({ message: "Title is invalid" });
            }
            if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, { min: 5 })) {
                errors.push({ message: "Content is invalid" });
            }
            post.title = postInput.title;
            post.content = postInput.content;
            if (postInput.imageUrl !== 'undefined') {
                post.imageUrl = postInput.imageUrl;
            }
            const updatedPost = await post.save();
            return {
            ...updatedPost._doc,
                _id: updatedPost._id.toString(),
                createdAt: updatedPost.createdAt.toISOString(),
                updatedAt: updatedPost.updatedAt.toISOString()
            };
        }
        catch (err) {
            return console.log(err);
        }

    },
    async deletePost({id},req) {
        if(!req.isAuth){
            const error = new Error('Not Authenticated!');
            error.code = 401;
            throw error;
        }
        try {
            const post = await Post.findById(id);
            if (!post) {
                const error_1 = new Error('No post found!');
                error_1.code = 404;
                throw error_1;
            }
            if (post.creator.toString() !== req.userId.toString()) {
                const error_2 = new Error('Not authorized');
                error_2.code = 403;
                throw error_2;
            }
            clearImage(post.imageUrl);
            const result = await Post.findByIdAndRemove(id);
            const user = await User.findById(req.userId);
            user.posts.pull(id);
            const result_1 = await user.save();
            return true;
        }
        catch (err) {
            return console.log(err);
        }
},
    user(args,req){
        if(!req.isAuth){
            const error = new Error('Not Authenticated!');
            error.code = 401;
            throw error;
        }
        return User.findById(req.userId)
        .then(user =>{
            if(!user){
                const error = new Error('No post found!');
                error.code = 404;
                throw error;
            }
            return{...user._doc,id:user._id.toString()};

        }).catch();

    },
    updateStatus({status},req){
        let currentUser;
        if(!req.isAuth){
            const error = new Error('Not Authenticated!');
            error.code = 401;
            throw error;
        }
        return User.findById(req.userId).then(user => {
            if(!user){
                const error = new Error('No post found!');
                error.code = 404;
                throw error;
            }
            currentUser = user;
            user.status = status;
            return user.save();
        }).then(result =>{
            return{
                ...currentUser._doc,_id:currentUser._id.toString()
            }
        }).catch();
    }
};