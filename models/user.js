const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const responseHandler = require('../utils/response');
const { validationResult } = require('express-validator');
const { post } = require('./vote');
const Post = require('./posts');
const sizeof = require('object-sizeof');
const Answer = require('./answers');
const Schema = mongoose.Schema;


const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true, unique: true },
    email: { type: String, required: false },
    views: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now }
})
userSchema.set('toJSON', { getters: true });
userSchema.options.toJSON.transform = (doc, ret) => {
    const obj = {...ret };
    delete obj._id;
    delete obj.__v;
    delete obj.password;
    return obj;
};


const Users = module.exports = mongoose.model('users', userSchema);

module.exports.register = async(newUser, result) => {
    const salt = bcrypt.genSaltSync(10);
    newUser.password = await bcrypt.hash(newUser.password, salt);
    newUser.username = newUser.username.toLowerCase();
    const user = new Users(newUser);

    try {
        const savedUser = await user.save();
        if (savedUser) {
            const payload = {
                user: {
                    id: user._id
                }
            }
            jwt.sign(payload, process.env.KEY, { expiresIn: 7200 }, (error, token) => {
                if (error) {

                    result(responseHandler.response(false, error.code, error.message, null), null);
                    return;
                }
                result(null, responseHandler.response(true, 200, 'User sigup successfully', { token }))
            })
        }
    } catch (err) {
        console.log(`User signup error : ${err}`);

    }
}

module.exports.loadUser = (userId, result) => {
    Users.findOne({
        _id: userId
    }, {
        _id: 1,
        username: 1,
        created_at: 1
    }).then((user) => {
        result(
            null,
            responseHandler.response(true, 200, 'Success', user),
        );
    }).catch((err) => {

        result(
            responseHandler.response(false, 400, `can not load user `, null),
            null
        );
    })


    //{
    //     console.log(err)
    //     if (!err) {

    //     } else {
    //         
    //     }
    // });


    // ).then((user) => {
    //     result(
    //         null,
    //         responseHandler.response(true, 200, 'Success', user),
    //     );

    // }).catch((err) => {
    //     console.log(err);
    //     result(
    //         responseHandler.response(false, 400, `can not load user ${user.username}`, null),
    //         null
    //     );
    // });
    // if (user) {
    //     result(
    //         null,
    //         responseHandler.response(true, 200, 'Success', user),
    //     );
    // } else {
    //     result(
    //         responseHandler.response(false, 400, `can not load user ${user.username}`, null),
    //         null
    //     );
    // }
}

module.exports.login = async(user, result) => {
    console.log(`user ${user.username} signin`);
    const findUser = await Users.findOne({
        username: user.username
    });
    if (findUser) {
        const isMatch = await bcrypt.compare(user.password, findUser.password.toString());

        if (!isMatch) {
            result(
                responseHandler.response(false, 400, 'Incorrect password', null),
                null,
            );
            return;
        } else {
            const payload = {
                user: {
                    id: findUser._id
                }
            };

            jwt.sign(
                payload,
                process.env.KEY, { expiresIn: 3600 },
                (err, token) => {
                    if (err) {

                        result(responseHandler.response(false, err.code, err.message, null), null);
                        return;
                    }
                    result(null, responseHandler.response(true, 200, 'login successfully', { token }));
                }
            )
        }
    } else {
        result(
            responseHandler.response(false, 400, 'User do not exist', null),
            null,
        );
        return;
    }
}
module.exports.getOneUser = async(id, results) => {
    try {
        await Users.findOneAndUpdate({ _id: id }, {
            $inc: {
                views: 1
            }
        }).lean();
        // Users.findById({ _id: id }, { password: 0 }).then((result) => {
        //     result.a = 1;
        //     console.log(result)
        //     result.post_count = Post.countDocuments({ user_id: result._id });
        //     result.answer_count = Answer.countDocuments({ user_id: result._id });
        //     result.comment_count = Post.countDocuments({ "comments.Author": result._id });
        //     results(null, responseHandler.response(true, 200, 'Success', result))
        // })


        // Post.aggregate([
        //         { $project: { comments: 1, _id: 0 } },
        //         { $unwind: '$comments' },
        //         {
        //             $match: {
        //                 "comments.Author": mongoose.Types.ObjectId(id)
        //             }
        //         },
        //         {
        //             $count: "comment_count"
        //         }
        //     ]),
        //     Answer.aggregate([
        //         { $project: { comments: 1, _id: 0 } },
        //         { $unwind: '$comments' },
        //         {
        //             $match: {
        //                 "comments.Author": mongoose.Types.ObjectId(id)
        //             }
        //         },
        //         {
        //             $count: "comment_count"
        //         }
        //     ]),
        //     Post.aggregate([
        //         { $match: { user_id: mongoose.Types.ObjectId(id) } },
        //         { $project: { tagname: 1, _id: 0 } },
        //         { $unwind: '$tagname' },
        //         { $group: { "_id": '$tagname', count: { $sum: 1 } } }
        //     ])

        Promise.all([
            Users.findOne({ _id: id }, { password: 0 }).lean(),
            Post.countDocuments({ user_id: id }).lean(),
            Answer.countDocuments({ author: id }).lean(),
            Post.aggregate([
                { $project: { comments: 1, _id: 0 } },
                { $unwind: '$comments' },
                {
                    $match: {
                        "comments.Author": mongoose.Types.ObjectId(id)
                    }
                },
                {
                    $count: "comment_count"
                }
            ]),
            Answer.aggregate([
                { $project: { comments: 1, _id: 0 } },
                { $unwind: '$comments' },
                {
                    $match: {
                        "comments.Author": mongoose.Types.ObjectId(id)
                    }
                },
                {
                    $count: "comment_count"
                }
            ]),
            Post.aggregate([
                { $match: { user_id: mongoose.Types.ObjectId(id) } },
                { $project: { tagname: 1, _id: 0 } },
                { $unwind: '$tagname' },
                { $group: { "_id": '$tagname', count: { $sum: 1 } } }
            ])
        ]).then((result) => {

            result = JSON.parse(JSON.stringify(result));
            const user = {
                ...result[0]
            }
            user.id = result[0]._id;
            user.post_count = result[1];
            user.answer_count = result[2];
            user.tag_count = result[5] != undefined ? result[5].length : 0;
            user.comment_count =
                (result[3][0] != undefined ? result[3][0].comment_count : 0) +
                (result[4][0] != undefined ? result[4][0].comment_count : 0)
            delete user.__v;
            delete user._id;
            results(null, responseHandler.response(true, 200, 'Success', user))
        })


    } catch (err) {
        console.log(err);
        results(responseHandler.response(false, 404, 'Not found', null), null)
    }


}
module.exports.getAllUser = async(results) => {
    try {
        Users.aggregate([{
                $lookup: {
                    from: "posts",
                    localField: "_id",
                    foreignField: "user_id",
                    as: "post_list"
                }
            },
            {
                $project: {
                    _id: 1,
                    username: 1,
                    views: 1,
                    created_at: 1,
                    "posts_count": { $cond: { if: { $isArray: "$post_list" }, then: { $size: "$post_list" }, else: "0" } }
                }
            }
        ]).then(async(result) => {

            for (const a of result) {
                await Post.aggregate([
                    { $match: { user_id: mongoose.Types.ObjectId(a._id) } },
                    { $project: { tagname: 1, _id: 0 } },
                    { $unwind: '$tagname' },
                    { $group: { "_id": '$tagname', count: { $sum: 1 } } }
                ]).then((result) => {
                    a.tag_count = result.reduce((numOfTag, tag) => {
                        return numOfTag + tag.count;
                    }, 0)
                    a.id = a._id;
                    delete a._id;
                })
            }
            results(null, responseHandler.response(true, 200, 'Success', result))
        }).catch((err) => {
            results(responseHandler.response(false, 500, `Request failed`, null), null)
        })






        // Users.find({}, { password: 0 }).lean().then((result) => {
        //     result = JSON.parse(JSON.stringify(result)).map((doc) => {
        //         const listTag = Post.aggregate([
        //             { $match: { user_id: mongoose.Types.ObjectId(doc._id) } },
        //             { $project: { tagname: 1, _id: 0 } },
        //             { $unwind: '$tagname' },
        //             { $group: { "_id": '$tagname', count: { $sum: 1 } } }
        //         ]).toArray();
        //         doc.listTag = listTag;
        //         return doc;
        //     });
        //     results(null, responseHandler.response(true, 200, 'Success', result))
        // })
    } catch (err) {
        console.log(err);
        results(responseHandler.response(false, 404, 'Not found', null), null)
    }
}