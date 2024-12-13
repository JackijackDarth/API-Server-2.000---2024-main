class Likes_API {
   static Host_URL() { return "https://enormous-decorous-shrine.glitch.me"; }
    //static Host_URL() { return "http://localhost:5000"; }
    static API_URL() { return this.Host_URL() + "/api/likes"; }

    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
    }

    static setHttpErrorState(xhr) {
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description;
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    static async HEAD() {
      Likes_API.initHttpState();
      return new Promise(resolve => {
          $.ajax({
              url: this.API_URL(),
              type: 'HEAD',
              contentType: 'text/plain',
              complete: data => { resolve(data.getResponseHeader('ETag')); },
              error: (xhr) => { Likes_API.setHttpErrorState(xhr); resolve(null); }
          });
      });
  }
    static async Save(data) {
      Posts_API.initHttpState();
      return new Promise(resolve => {
          $.ajax({
              url: this.API_URL() ,
              type: "POST",
              contentType: 'application/json',
              data: JSON.stringify(data),
              success: (data) => { resolve(data); },
              error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
          });
      });
  }
    // static async Save(data) {
    //     try {
    //       return new Promise((resolve, reject) => {
    //         $.ajax({
    //           url: this.API_URL(),
    //           type: "POST",
    //           contentType: 'application/json',
    //           data: JSON.stringify(data),
    //           success: (response) => {
    //             console.log("Like enregistré :", response);
    //             resolve(response);
    //           },
    //           error: (xhr) => {
    //             console.error("Erreur AJAX", xhr.responseText);
    //             reject(xhr.responseText);
    //           }
    //         });
    //       });
    //     } catch (e) {
    //       console.error("Erreur lors de Save AJAX", e);
    //     }
    //   }
    // static async Delete(id) {
    //     return new Promise(resolve => {
    //         $.ajax({
    //             url: this.API_URL() + "/" + id,
    //             type: "DELETE",
    //             complete: () => Likes_API.initHttpState(),
    //             error: xhr => Likes_API.setHttpErrorState(xhr)
    //         });
    //     });
    // }
    static async Delete(id) {
      return new Promise(resolve => {
          $.ajax({
              url: this.API_URL() + "/" + id,
              type: "DELETE",
              complete: () => {
                  Likes_API.initHttpState();
                  resolve(true);
              },
              error: (xhr) => {
                Likes_API.setHttpErrorState(xhr); resolve(null);
              }
          });
      });
  }
    static async Get(id = null) {
      Posts_API.initHttpState();
      return new Promise(resolve => {
          $.ajax({
              url: this.API_URL() + (id != null ? "/" + id : ""),
              complete: data => { resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON }); },
              error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
          });
      });
  }
    // static async GetLikesByPostId(postId) {
    //     return new Promise(resolve => {
    //         $.ajax({
    //             url: `${this.API_URL()}/${postId}`,
    //             complete: data => resolve(data.responseJSON || []),
    //             error: xhr => Likes_API.setHttpErrorState(xhr)
    //         });
    //     });
    // }
    async DeleteLike(userId, postId) {
        try {
          await this.repository.delete({ UserId: userId, PostId: postId });
          return { success: true };
        } catch (error) {
          console.error("Impossible de supprimer le Like", error);
        }
      }
}